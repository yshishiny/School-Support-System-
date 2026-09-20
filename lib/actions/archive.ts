"use server";

import { revalidatePath } from "next/cache";
import { failed } from "@/lib/ops/fault";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveStats, parseArchiveText, parseArchiveZip, sampleForModel, type ArchiveMessage } from "@/lib/whatsapp/archive";
import { learnArchiveConventions } from "@/lib/ai/archive-insights";

const BUCKET = "chat-archives";
const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // larger videos stay out; the message still records them

export interface ProcessResult {
  error?: string;
  archiveId?: string;
  messages?: number;
  attachments?: number;
}

/** After the browser uploaded the export to Storage, unpack it, store messages + media, and learn the group's conventions. */
export async function processChatArchiveAction(storagePath: string, label: string, studentId: string | null): Promise<ProcessResult> {
  const { family, profile } = await requireParent();
  if (!storagePath.startsWith(`${family.id}/`)) return { error: "That upload does not belong to your family." };
  const admin = createAdminClient();

  const { data: row, error: insErr } = await admin
    .from("chat_archives")
    .insert({ family_id: family.id, student_id: studentId || null, label: label.trim().slice(0, 120) || "WhatsApp export", storage_path: storagePath, status: "processing", uploaded_by: profile.id })
    .select("id")
    .single();
  if (insErr || !row) return failed("actions.archive.processChatArchive", insErr, "Could not register the archive.");
  const archiveId = row.id as string;

  // Whatever went wrong is written on the archive row, where the parent reads it, and into the ops log under
  // the same reference, so the two can be put side by side.
  const fail = async (cause: unknown, user?: string) => {
    const { error: msg } = await failed("actions.archive.processChatArchive", cause, user);
    await admin.from("chat_archives").update({ status: "failed", error: msg }).eq("id", archiveId);
    revalidatePath("/parent/import/archive");
    return { error: msg, archiveId };
  };

  try {
    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(storagePath);
    if (dlErr || !blob) return await fail(dlErr?.message ?? "Could not read the upload.");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    let messages: ArchiveMessage[];
    let files: { name: string; data: Uint8Array; kind: string }[] = [];
    if (storagePath.toLowerCase().endsWith(".zip")) {
      const parsed = parseArchiveZip(bytes);
      messages = parsed.messages;
      files = parsed.files;
    } else {
      messages = parseArchiveText(new TextDecoder("utf-8").decode(bytes));
    }
    if (messages.length === 0) return await fail("No messages were found. Export the chat from WhatsApp (with or without media) and upload the .zip or .txt it produces.");

    // Media: upload each referenced file next to the archive.
    const byName = new Map(files.map((f) => [f.name, f]));
    const pathFor = new Map<string, string>();
    let attachments = 0;
    for (const m of messages) {
      if (!m.attachmentName) continue;
      attachments += 1;
      const f = byName.get(m.attachmentName);
      if (!f || f.data.length > MAX_MEDIA_BYTES || pathFor.has(m.attachmentName)) continue;
      const path = `${family.id}/${archiveId}/media/${m.attachmentName}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, f.data, { upsert: true, contentType: contentTypeFor(m.attachmentName) });
      if (!upErr) pathFor.set(m.attachmentName, path);
    }

    // Messages, in batches.
    const rows = messages.map((m) => ({
      archive_id: archiveId,
      family_id: family.id,
      sent_date: /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : "1970-01-01",
      sent_time: m.time,
      sender: m.sender.slice(0, 120),
      text: m.text.slice(0, 4000),
      attachment_name: m.attachmentName,
      attachment_kind: m.attachmentKind,
      attachment_path: m.attachmentName ? pathFor.get(m.attachmentName) ?? null : null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: mErr } = await admin.from("chat_messages").insert(rows.slice(i, i + 500));
      if (mErr) return await fail(`Could not save messages: ${mErr.message}`);
    }

    const stats = archiveStats(messages);
    let insights: { summary_md: string; conventions: string[]; key_senders: { name: string; role: string }[] } | null = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const statsLine = `${messages.length} messages from ${stats.firstDate} to ${stats.lastDate}; ${attachments} attachments (${Object.entries(stats.kinds).map(([k, v]) => `${v} ${k}`).join(", ") || "none"}); top senders: ${stats.senders.slice(0, 6).map((s) => `${s.name} (${s.messages})`).join(", ")}.`;
        insights = await learnArchiveConventions(sampleForModel(messages), statsLine);
      } catch (err) {
        console.error("[archive] insights failed", err);
      }
    }
    const insightsMd = insights
      ? `${insights.summary_md}\n\n**Conventions the importer will use:**\n${insights.conventions.map((c) => `- ${c}`).join("\n")}\n\n**Key senders:** ${insights.key_senders.map((k) => `${k.name} (${k.role})`).join(", ")}`
      : null;

    await admin
      .from("chat_archives")
      .update({
        status: "ready",
        message_count: messages.length,
        attachment_count: attachments,
        first_date: stats.firstDate,
        last_date: stats.lastDate,
        stats: { ...stats, conventions: insights?.conventions ?? [] },
        insights_md: insightsMd,
        processed_at: new Date().toISOString(),
      })
      .eq("id", archiveId);
    revalidatePath("/parent/import/archive");
    return { archiveId, messages: messages.length, attachments };
  } catch (err) {
    return await fail(err, "The archive could not be read.");
  }
}

export async function deleteChatArchiveAction(archiveId: string): Promise<{ error?: string }> {
  const { family } = await requireParent();
  const admin = createAdminClient();
  const { data: a } = await admin.from("chat_archives").select("id, storage_path").eq("id", archiveId).eq("family_id", family.id).maybeSingle();
  if (!a) return { error: "Archive not found." };
  const { data: list } = await admin.storage.from(BUCKET).list(`${family.id}/${archiveId}/media`, { limit: 1000 });
  const paths = [a.storage_path, ...(list ?? []).map((o) => `${family.id}/${archiveId}/media/${o.name}`)];
  await admin.storage.from(BUCKET).remove(paths);
  await admin.from("chat_archives").delete().eq("id", archiveId);
  revalidatePath("/parent/import/archive");
  return {};
}

function contentTypeFor(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", pdf: "application/pdf", opus: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  return map[ext] ?? "application/octet-stream";
}
