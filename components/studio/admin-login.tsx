"use client";

import * as React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/primitives/button";
import { Field, Input } from "@/components/primitives/field";
import type { AuthResult } from "@/lib/auth/actions";
import { pick } from "@/content/locale";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function AdminLogin({
  action,
  locale,
  d,
}: {
  action: (prev: AuthResult | null, formData: FormData) => Promise<AuthResult>;
  locale: Locale;
  d: Dictionary;
}) {
  const [state, formAction, pending] = React.useActionState(action, null);

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <span className="font-mono text-[12px] tracking-[0.18em] text-ink uppercase">Studio</span>
        </div>

        <h1 className="mt-8 text-[clamp(1.6rem,3.4vw,2.25rem)] leading-tight tracking-[-0.035em]">
          {pick(locale, "Панель управления", "Control panel")}
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-3">
          {pick(
            locale,
            "Доступ по административному паролю. Сессия живёт 8 часов.",
            "Access with the admin password. The session lasts 8 hours.",
          )}
        </p>

        <form action={formAction} className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <Field label={d.auth.password} htmlFor="admin-password" required>
            <Input id="admin-password" name="password" type="password" autoComplete="current-password" required autoFocus />
          </Field>

          {state?.message && (
            <p
              role="alert"
              className="flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] leading-snug text-ink-2"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              {state.message === "network" ? d.errors.network : pick(locale, "Неверный пароль", "Wrong password")}
            </p>
          )}

          <Button type="submit" size="lg" full loading={pending}>
            {d.auth.submitSignIn}
          </Button>
        </form>

        <p className="mt-6 flex items-center gap-2 text-[12.5px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          {pick(locale, "Токен хранится в httpOnly-cookie", "The token lives in an httpOnly cookie")}
        </p>
      </div>
    </div>
  );
}
