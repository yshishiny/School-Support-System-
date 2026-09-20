import { createAdminClient } from "@/lib/supabase/admin";
import { notifyParents } from "@/lib/notify";
import { prettyDate, todayIn } from "@/lib/dates";
import { WARN_DAYS_BEFORE, egpFor, expiringAccess, priceList, type AccessGrant } from "@/lib/access";
import { attempt } from "@/lib/ops/fault";

/**
 * Tell a parent before the teacher goes quiet.
 *
 * Access simply stopped on its end date with nothing said, which is exactly how a family that meant to renew
 * becomes one that did not. The warning goes out twice and only twice: three days before, while there is still
 * time to act, and on the day itself. Which of the two has been sent is written on the grant, so a nightly job
 * cannot turn a reminder into noise.
 */
export async function warnAboutExpiringAccess(day?: string): Promise<string[]> {
  return attempt("access.expiryWarning", async () => {
    const admin = createAdminClient();
    const out: string[] = [];
    const { data: families } = await admin.from("families").select("id, timezone");
    for (const f of families ?? []) {
      const familyId = f.id as string;
      const today = day ?? todayIn((f.timezone as string) ?? "Africa/Cairo");
      const [{ data: grantRows }, { data: kids }] = await Promise.all([
        admin.from("access_grants").select("id, student_id, starts_on, ends_on, plan, warned_days_left").eq("family_id", familyId),
        admin.from("profiles").select("id, full_name").eq("family_id", familyId).eq("role", "student"),
      ]);
      const grants = (grantRows ?? []) as (AccessGrant & { id: string; warned_days_left: number | null })[];
      const students = (kids ?? []) as { id: string; full_name: string }[];
      if (grants.length === 0 || students.length === 0) continue;

      const due = expiringAccess(grants, students.map((s) => s.id), today);
      if (due.length === 0) continue;

      // One note per family per moment, naming every child it touches, rather than one note per child.
      const byDays = new Map<number, string[]>();
      for (const d of due) {
        const name = students.find((s) => s.id === d.studentId)?.full_name.split(" ")[0] ?? "a child";
        byDays.set(d.daysLeft, [...(byDays.get(d.daysLeft) ?? []), name]);
      }

      for (const [daysLeft, names] of byDays) {
        // The grant that actually ends at this moment is the one that records the warning.
        const ending = grants.filter((g) => !!due.find((d) => d.endsOn === g.ends_on && (g.student_id === null || g.student_id === d.studentId)));
        const unsent = ending.filter((g) => g.warned_days_left === null || g.warned_days_left > daysLeft);
        if (unsent.length === 0) continue;

        const who = names.join(" and ");
        const endsOn = due.find((d) => d.daysLeft === daysLeft)!.endsOn;
        const month = priceList().find((p) => p.plan.id === "child_month");
        const cost = month ? ` Another month for one child is ${egpFor(month.plan.credits).toLocaleString()} EGP.` : "";
        const text = daysLeft === 0
          ? `🎓 *The teacher stops today* for ${who}. Their written lessons stay open; the teacher comes back the moment you renew.${cost}`
          : `🎓 *${who}* ${names.length > 1 ? "lose" : "loses"} the teacher in ${daysLeft} day${daysLeft === 1 ? "" : "s"}, on ${prettyDate(endsOn)}. Renewing now keeps it unbroken.${cost}`;
        await notifyParents(familyId, text, { kind: "info", url: "/parent/access" });
        await admin.from("access_grants").update({ warned_days_left: daysLeft }).in("id", unsent.map((g) => g.id));
        out.push(`${who}: ${daysLeft === 0 ? "ended today" : `${daysLeft} days left`}`);
      }
    }
    return out;
  }, [] as string[]);
}

export { WARN_DAYS_BEFORE };
