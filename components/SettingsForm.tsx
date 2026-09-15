"use client";

import { useActionState } from "react";
import { updateFamilyAction, connectTelegramAction, disconnectTelegramAction } from "@/lib/actions/children";
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

export function TelegramSettings({ family, botUsername }: { family: Family; botUsername: string | null }) {
  const [state, action] = useActionState(connectTelegramAction, undefined);
  return (
    <div className="card space-y-3">
      <h2 className="h2">Telegram delivery</h2>
      {family.telegram_chat_id ? (
        <>
          <p className="text-sm text-good">Connected. Daily reports go to Telegram chat {family.telegram_chat_id}.</p>
          <form action={disconnectTelegramAction}><button className="btn-ghost btn-sm">Disconnect</button></form>
        </>
      ) : (
        <form action={action} className="space-y-3">
          <ol className="text-sm muted list-decimal pl-5 space-y-1">
            <li>Open Telegram and search for {botUsername ? <b className="text-ink">@{botUsername}</b> : "your bot"}.</li>
            <li>Tap <b className="text-ink">Start</b> and send any message.</li>
            <li>Come back here and tap Connect.</li>
          </ol>
          <details>
            <summary className="text-xs muted cursor-pointer">Advanced: enter your own chat ID</summary>
            <input name="telegram_chat_id" className="input mt-2" inputMode="numeric" placeholder="Your numeric ID from @userinfobot, not the bot's" />
          </details>
          <Notice error={state?.error} ok={state?.ok} />
          <SubmitButton className="btn-primary" pendingText="Connecting…">Connect Telegram</SubmitButton>
        </form>
      )}
    </div>
  );
}
