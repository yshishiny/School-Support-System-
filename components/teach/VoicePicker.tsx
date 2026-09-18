"use client";

import { voiceLabel } from "./useSpeech";

const REGION: Record<string, string> = { EG: "🇪🇬 Egypt", SA: "🇸🇦 Saudi", AE: "🇦🇪 Emirates", MA: "🇲🇦 Morocco", JO: "🇯🇴 Jordan", LB: "🇱🇧 Lebanon", KW: "🇰🇼 Kuwait", QA: "🇶🇦 Qatar", BH: "🇧🇭 Bahrain", OM: "🇴🇲 Oman", TN: "🇹🇳 Tunisia", DZ: "🇩🇿 Algeria", IQ: "🇮🇶 Iraq", SY: "🇸🇾 Syria", XA: "Arabic", US: "🇺🇸 US", GB: "🇬🇧 UK", AU: "🇦🇺 Australia", IN: "🇮🇳 India", IE: "🇮🇪 Ireland", ZA: "🇿🇦 South Africa", CA: "🇨🇦 Canada" };

/**
 * The voices this phone has for the lesson's language. Egyptian ones come first; each can be tried before
 * choosing; the choice is kept on the device. With none installed, how to add one.
 */
export function VoicePicker({ voices, current, language, onPick, onPreview, onClose }: { voices: SpeechSynthesisVoice[]; current: string | null; language: "en" | "ar"; onPick: (uri: string) => void; onPreview: (uri: string) => void; onClose: () => void }) {
  const rtl = language === "ar";
  const sorted = [...voices].sort((a, b) => Number(voiceLabel(b).egyptian) - Number(voiceLabel(a).egyptian) || Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
  return (
    <div className="absolute inset-x-3 top-[calc(max(.5rem,env(safe-area-inset-top))+3.4rem)] bottom-[calc(max(.5rem,env(safe-area-inset-bottom))+5rem)] z-40 rounded-2xl bg-black/80 backdrop-blur p-3 text-white flex flex-col gap-2" dir={rtl ? "rtl" : undefined}>
      <div className="flex items-center justify-between">
        <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>🔊 {rtl ? "صوت المعلم" : "Teacher's voice"}</div>
        <button type="button" className="btn-ghost btn-sm" onClick={onClose}>{rtl ? "تم" : "Done"}</button>
      </div>
      <p className="text-xs text-white/70">{rtl ? "الأصوات مثبتة على هذا الهاتف. جرّب كل صوت ثم اختر؛ الاختيار يُحفظ هنا." : "These voices are installed on this phone. Try each, then choose; the choice is kept on this device."}</p>
      {sorted.length === 0 ? (
        <div className="text-sm space-y-2 rounded-xl bg-white/10 p-3">
          <p>{rtl ? "لا يوجد صوت عربي مثبت على هذا الهاتف." : "No voice for this language is installed on this phone."}</p>
          <p className="text-xs text-white/70">{rtl ? "أندرويد: الإعدادات ← الإدارة العامة ← تحويل النص إلى كلام ← Google ← تثبيت بيانات الصوت ← العربية (مصر). ثم أعد فتح الدرس." : "Android: Settings → General management → Text-to-speech → Google (or Samsung) → Install voice data → Arabic (Egypt). Then reopen the lesson. iPhone: Settings → Accessibility → Spoken Content → Voices → Arabic."}</p>
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-auto divide-y divide-white/10">
          {sorted.map((v) => {
            const l = voiceLabel(v);
            const on = v.voiceURI === current;
            return (
              <li key={v.voiceURI} className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{l.egyptian ? "🇪🇬 " : ""}{l.name}{on ? <span className="ms-2 text-good text-xs">✓ {rtl ? "المختار" : "chosen"}</span> : null}</div>
                  <div className="text-[11px] text-white/60">{REGION[l.region] ?? l.region} · {v.localService ? (rtl ? "على الهاتف" : "on the phone") : (rtl ? "عبر الإنترنت" : "online")}</div>
                </div>
                <button type="button" className="btn-ghost btn-sm !py-1" onClick={() => onPreview(v.voiceURI)}>▶ {rtl ? "جرّب" : "Try"}</button>
                {!on && <button type="button" className="btn-primary btn-sm !py-1" onClick={() => onPick(v.voiceURI)}>{rtl ? "اختر" : "Choose"}</button>}
              </li>
            );
          })}
        </ul>
      )}
      {sorted.length > 0 && !sorted.some((v) => voiceLabel(v).egyptian) && language === "ar" && (
        <p className="text-[11px] text-[#ffd166]">{rtl ? "لا يوجد صوت مصري هنا. لإضافته: الإعدادات ← تحويل النص إلى كلام ← تثبيت بيانات الصوت ← العربية (مصر)." : "No Egyptian voice on this phone. To add one: Settings → Text-to-speech → Install voice data → Arabic (Egypt)."}</p>
      )}
    </div>
  );
}
