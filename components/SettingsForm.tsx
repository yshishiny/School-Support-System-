"use client";

import { useActionState } from "react";
import { updateFamilyAction } from "@/lib/actions/children";
import type { Family } from "@/lib/types";
import { Notice, SubmitButton } from "./ui";

export function SettingsForm({ family }: { family: Family }) {
  const [state, action] = useActionState(updateFamilyAction, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="h2">Family settings</h2>
      <div>
        <label className="label">Family name</label>
        <input name="name" className="input" defaultValue={family.name} />
      </div>
      <div>
        <label className="label">Your WhatsApp number (country code, digits only)</label>
        <input name="parent_whatsapp" className="input" inputMode="numeric" placeholder="2010xxxxxxxx" defaultValue={family.parent_whatsapp ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Timezone</label>
          <input name="timezone" className="input" defaultValue={family.timezone} />
        </div>
        <div>
          <label className="label">Report after (hour, 0-23)</label>
          <input name="report_hour" type="number" min={0} max={23} className="input" defaultValue={family.report_hour} />
        </div>
      </div>
      <Notice error={state?.error} ok={state?.ok} />
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
