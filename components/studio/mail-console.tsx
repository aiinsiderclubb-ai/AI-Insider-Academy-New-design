"use client";

import * as React from "react";
import { Button } from "@/components/primitives/button";
import { Field, Input } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import { pick } from "@/content/locale";
import { previewEmailTemplate, sendStudioTestEmail } from "@/lib/api/studio-actions";
import type { EmailTemplateInfo } from "@/lib/api/studio";
import type { Locale } from "@/lib/i18n/config";

export function MailConsole({
  locale,
  templates,
  smtpOn,
}: {
  locale: Locale;
  templates: EmailTemplateInfo[];
  smtpOn: boolean;
}) {
  const { push } = useToast();
  const [template, setTemplate] = React.useState(templates[0]?.id ?? "welcome_1");
  const [lang, setLang] = React.useState<Locale>(locale);
  const [subject, setSubject] = React.useState("");
  const [html, setHtml] = React.useState("");
  const [email, setEmail] = React.useState("info@myinsideracademy.com");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (id: string, nextLocale: Locale) => {
    const result = await previewEmailTemplate(id, nextLocale);
    setSubject(result.subject || "");
    setHtml("error" in result && result.error ? `<p>${result.error}</p>` : result.html);
  }, []);

  React.useEffect(() => {
    void load(template, lang);
  }, [template, lang, load]);

  async function sendTest() {
    setBusy(true);
    const result = await sendStudioTestEmail(locale, email, template);
    setBusy(false);
    push({
      tone: result.ok ? "success" : "warning",
      title: result.ok
        ? pick(locale, "Письмо отправлено", "Email sent")
        : (result.message ?? pick(locale, "Не удалось отправить", "Send failed")),
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Field label={pick(locale, "Шаблон", "Template")}>
          <select
            className="h-10 w-full rounded-md border border-line bg-surface px-3 text-[13px]"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
          >
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name[lang] || item.name.ru} · {item.kind}
              </option>
            ))}
          </select>
        </Field>
        <Field label={pick(locale, "Язык превью", "Preview language")}>
          <select
            className="h-10 w-full rounded-md border border-line bg-surface px-3 text-[13px]"
            value={lang}
            onChange={(event) => setLang(event.target.value as Locale)}
          >
            <option value="ru">RU</option>
            <option value="ukr">UKR</option>
            <option value="en">EN</option>
          </select>
        </Field>
        <Field label={pick(locale, "Тест на ящик", "Send a test")}>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@domain.com"
          />
        </Field>
        <Button type="button" disabled={busy || !smtpOn} onClick={() => void sendTest()}>
          {smtpOn
            ? pick(locale, "Отправить тест", "Send test")
            : pick(locale, "SMTP выключен", "SMTP is off")}
        </Button>
        {subject ? <p className="text-[12.5px] text-muted">{subject}</p> : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-[#07060f]">
        <iframe
          title={pick(locale, "Превью письма", "Email preview")}
          srcDoc={html}
          sandbox=""
          className="h-[720px] w-full bg-[#07060f]"
        />
      </div>
    </div>
  );
}
