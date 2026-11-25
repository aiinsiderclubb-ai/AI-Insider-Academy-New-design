/**
 * The answers the «Найди своё в AI» application offers. The form shows them,
 * the API stores the ids, and Studio turns the ids back into these words —
 * one list, so a renamed option cannot drift apart between the two.
 */
export type Option = { id: string; ru: string; en: string };

export const ACTIVITY: Option[] = [
  { id: "studying", ru: "Учусь", en: "Studying" },
  { id: "working", ru: "Работаю", en: "Working" },
  { id: "freelance", ru: "Фриланс", en: "Freelancing" },
  { id: "entrepreneur", ru: "Свой бизнес", en: "Running a business" },
  { id: "job_seeking", ru: "Ищу работу", en: "Looking for work" },
  { id: "other", ru: "Другое", en: "Other" },
];

export const EXPERIENCE: Option[] = [
  { id: "newbie", ru: "Нет, я новичок", en: "None, I'm new to it" },
  { id: "chatgpt_simple", ru: "Использую ChatGPT для простых задач", en: "I use ChatGPT for simple tasks" },
  { id: "regular", ru: "Использую AI регулярно", en: "I use AI regularly" },
  { id: "automations", ru: "Делаю автоматизации или ботов", en: "I build automations or bots" },
  { id: "professional", ru: "Работаю с AI профессионально", en: "I work with AI professionally" },
];

/** The nine directions the course walks through, plus "not sure" — the honest answer for most applicants. */
export const DIRECTIONS: Option[] = [
  { id: "productivity", ru: "AI в работе", en: "AI at work" },
  { id: "content", ru: "Контент", en: "Content" },
  { id: "video", ru: "AI-видео", en: "AI video" },
  { id: "automation", ru: "Автоматизации", en: "Automation" },
  { id: "chatbots", ru: "Чат-боты", en: "Chatbots" },
  { id: "voice", ru: "Голосовые роботы", en: "Voice agents" },
  { id: "agents", ru: "AI-агенты", en: "AI agents" },
  { id: "vibecoding", ru: "Вайбкодинг", en: "Vibe coding" },
  { id: "sales", ru: "Продажа AI-услуг", en: "Selling AI services" },
  { id: "undecided", ru: "Пока не знаю", en: "Not sure yet" },
];

export const SOURCES: Option[] = [
  { id: "telegram", ru: "Telegram", en: "Telegram" },
  { id: "instagram", ru: "Instagram", en: "Instagram" },
  { id: "tiktok", ru: "TikTok", en: "TikTok" },
  { id: "youtube", ru: "YouTube", en: "YouTube" },
  { id: "google", ru: "Google", en: "Google" },
  { id: "referral", ru: "Рекомендация", en: "A friend's recommendation" },
  { id: "other", ru: "Другое", en: "Other" },
];

/** The label for a stored id, or the id itself when the list no longer has it. */
export function optionLabel(options: Option[], id: string | null | undefined, locale: string): string {
  if (!id) return "";
  const option = options.find((item) => item.id === id);
  if (!option) return id;
  return locale === "en" ? option.en : option.ru;
}
