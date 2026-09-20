import { createAdminClient } from "@/lib/supabase/admin";
import { report } from "@/lib/ops/fault";
import type { WalletEntry } from "@/lib/wallet";

/**
 * Reading and writing the wallet ledger.
 *
 * These live here rather than in `lib/actions/wallet.ts` on purpose. Every export of a `"use server"` module is a
 * callable endpoint, and these three take a student and a family from their caller and write with the service-role
 * key — which, sitting in that file, made "credit any child any amount" a public action. They are ordinary server
 * helpers, called by actions that have already established who is asking, so they belong in an ordinary module.
 */

/** What a write to the ledger did. `ref` is the reference a person can quote back; it is only ever set on failure. */
export type LedgerWrite = { ok: true } | { ok: false; ref: string };

export interface LedgerEntry {
  studentId: string;
  familyId: string;
  amount: number;
  label: string;
  /** The day the money moved, not the day the row was written. */
  on: string;
  /** What caused it, and the id of that thing: together these make the write happen once however many times it is asked for. */
  refType: string;
  refId: string;
  by?: string | null;
}

/** Everything in a child's wallet, oldest first, for the balances and the history. */
export async function loadWallet(studentId: string): Promise<WalletEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("wallet_entries")
    .select("id, kind, amount_egp, label, category, occurred_on, note, claim_status, claim_purpose, claim_reason, asked_permission, claim_note")
    .eq("student_id", studentId)
    .order("occurred_on")
    .order("created_at");
  return ((data ?? []) as WalletEntry[]).map((e) => ({ ...e, amount_egp: Number(e.amount_egp) }));
}

async function write(kind: "earn" | "withdraw", where: string, o: LedgerEntry): Promise<LedgerWrite> {
  if (!(o.amount > 0)) return { ok: true };
  const admin = createAdminClient();
  const { error } = await admin.from("wallet_entries").upsert(
    {
      student_id: o.studentId,
      family_id: o.familyId,
      kind,
      amount_egp: o.amount,
      label: o.label.slice(0, 80),
      occurred_on: o.on,
      ref_type: o.refType,
      ref_id: o.refId,
      created_by: o.by ?? null,
    },
    { onConflict: "student_id,ref_type,ref_id", ignoreDuplicates: true },
  );
  // Money that fails to reach the ledger is the whole point of the ledger, so this is never swallowed: the row
  // that did not get written is recorded under its own reference, with the child and the amount attached.
  if (error) {
    return {
      ok: false,
      ref: await report(where, error, {
        userId: o.studentId,
        familyId: o.familyId,
        meta: { kind, refType: o.refType, refId: o.refId, amount: o.amount, on: o.on },
      }),
    };
  }
  return { ok: true };
}

/**
 * Money earned, credited once. `refType`/`refId` keep it that way: a paid allowance week or a cash reward can be
 * recorded twice by two taps and still add up only once.
 */
export function creditWallet(o: LedgerEntry): Promise<LedgerWrite> {
  return write("earn", "wallet.credit", o);
}

/** A hand-over recorded once, keyed to what caused it, so marking a week paid twice cannot take the money twice. */
export function withdrawFromWallet(o: LedgerEntry): Promise<LedgerWrite> {
  return write("withdraw", "wallet.withdraw", o);
}
