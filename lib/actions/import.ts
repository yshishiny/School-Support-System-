"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppExport, filterSince, renderForModel } from "@/lib/whatsapp/parse-export";
import { extractItemsFromMessages, type ExtractedItem } from "@/lib/ai/extract-items";
import { todayIn, shiftDate } from "@/lib/dates";

export interface AnalyzeResult {
  error?: string;
  studentId?: string;
  messageCount?: number;
  summary?: string;
  items?: ExtractedItem[];
}

const MAX_MESSAGES = 600;

export async function analyzeExportAction(_prev: AnalyzeResult | undefined, formData: FormData): Promise<AnalyzeResult> {
  const { family } = await requireParent();
  const studentId = String(formData.get("student_id") ?? "");
  if (!studentId) return { error: "Choose which child this group belongs to." };

  let raw = String(formData.get("pasted") ?? "");
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) raw = await file.text();
  if (!raw.trim()) return { error: "Upload the exported .txt file or paste the messages." };

  const today = todayIn(family.timezone);
  const since = String(formData.get("since") ?? "") || shiftDate(today, -14);
  const all = parseWhatsAppExport(raw);
  let messages = filterSince(all, since);
  if (messages.length === 0) {
    return { error: `Found ${all.length} messages but none since ${since}. Check the date or the file format.` };
  }
  if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);

  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured on the server." };
  try {
    const extraction = await extractItemsFromMessages(renderForModel(messages), today);
    return { studentId, messageCount: messages.length, summary: extraction.summary, items: extraction.items };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Analysis failed." };
  }
}

export async function confirmImportAction(studentId: string, items: ExtractedItem[], messageCount: number): Promise<{ added: number; skipped: number }> {
  const { family, profile } = await requireParent();
  const supabase = await createClient();

  const { data: subjects } = await supabase.from("subjects").select("id,name").eq("student_id", studentId);
  const { data: existing } = await supabase.from("assignments").select("title,due_date").eq("student_id", studentId);
  const seen = new Set((existing ?? []).map((e) => `${e.title.toLowerCase()}|${e.due_date ?? ""}`));

  let added = 0;
  let skipped = 0;
  const rows = [];
  for (const it of items) {
    const key = `${it.title.toLowerCase()}|${it.due_date ?? ""}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const subject = (subjects ?? []).find((s) => it.subject && s.name.toLowerCase() === it.subject.toLowerCase());
    rows.push({
      student_id: studentId,
      subject_id: subject?.id ?? null,
      subject_name: it.subject,
      kind: it.kind,
      title: it.title,
      details: it.details,
      due_date: it.due_date,
      source: "whatsapp",
      source_excerpt: it.source_excerpt.slice(0, 1000),
      created_by: profile.id,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("assignments").insert(rows);
    if (!error) added = rows.length;
  }
  await supabase.from("whatsapp_imports").insert({
    family_id: family.id,
    student_id: studentId,
    message_count: messageCount,
    items_found: items.length,
    items_added: added,
    imported_by: profile.id,
  });
  ["/parent", "/parent/assignments", "/parent/import", "/today", "/calendar"].forEach((p) => revalidatePath(p));
  return { added, skipped };
}
