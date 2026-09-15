/** Safety layer for the coach chat and check-ins: what counts as danger, and how the parent is told. */
export type RiskLevel = "none" | "low" | "moderate" | "high";
export type RiskCategory = "self_harm" | "harm_by_others" | "substance" | "severe_distress" | "low_wellbeing" | "other";

/** Egyptian helplines shown to the child when risk is moderate or high. */
export const HELPLINES = [
  { name: "خط نجدة الطفل · Child Helpline (NCCM)", number: "16000" },
  { name: "الصحة النفسية · Mental health hotline", number: "08008880700" },
  { name: "الإسعاف · Ambulance", number: "123" },
];

/** The message a parent receives. Deliberately short and without quotes: the point is to talk, not to read a transcript. */
export function parentAlertText(studentName: string, level: "amber" | "red", category: RiskCategory): string {
  const what: Record<RiskCategory, string> = {
    self_harm: "said something that suggests thoughts of hurting himself",
    harm_by_others: "described being hurt or threatened by someone",
    substance: "mentioned drugs, alcohol or smoking",
    severe_distress: "sounded in serious distress",
    low_wellbeing: "has reported low wellbeing for a while",
    other: "said something the coach thinks you should know about",
  };
  if (level === "red") {
    return `🚨 *Please talk to ${studentName} today.*\nIn the study app's coach chat he ${what[category]}. The app has shown him helpline numbers and told him you will be there for him. Sit with him calmly, listen first. If you think he is in immediate danger call 123.`;
  }
  return `💛 *A gentle heads-up about ${studentName}.*\nHis recent check-ins with the study coach suggest he ${what[category]}. Nothing urgent was flagged, but a relaxed conversation this week, with no questions about grades, would help.`;
}
