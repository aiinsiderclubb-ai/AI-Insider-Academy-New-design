"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Input } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import type { AuthResult } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";

type Action = (prev: AuthResult | null, formData: FormData) => Promise<AuthResult>;

function Alert({ tone, children }: { tone: "danger" | "success"; children: React.ReactNode }) {
  const Icon = tone === "danger" ? AlertTriangle : CheckCircle2;
  return (
    <p
      role="alert"
      className={
        tone === "danger"
          ? "flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] leading-snug text-ink-2"
          : "flex gap-2 rounded-md border border-success/30 bg-success-soft px-3.5 py-3 text-[13px] leading-snug text-ink-2"
      }
    >
      <Icon className={tone === "danger" ? "mt-0.5 h-4 w-4 shrink-0 text-danger" : "mt-0.5 h-4 w-4 shrink-0 text-success"} aria-hidden />
      {children}
    </p>
  );
}

function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder,
  required,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Input
      id={id}
      name={name}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      placeholder={placeholder}
      required={required}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      }
    />
  );
}

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button type="submit" size="lg" full loading={pending}>
      {label}
    </Button>
  );
}

/* ================================= sign in ================================= */

export function SignInForm({
  action,
  locale,
  d,
  next,
  justReset,
}: {
  action: Action;
  locale: Locale;
  d: Dictionary;
  next?: string;
  justReset?: boolean;
}) {
  const [state, formAction, pending] = React.useActionState(action, null);

  return (
    <div>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-[-0.035em]">{d.auth.signInTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{d.auth.signInBody}</p>

      {justReset && (
        <div className="mt-6">
          <Alert tone="success">{d.auth.resetBody}</Alert>
        </div>
      )}

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}

        <Field label={d.auth.email} htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state?.email}
            required
          />
        </Field>

        <Field
          label={d.auth.password}
          htmlFor="password"
          required
          action={
            <Link
              href={path("/forgot-password", locale)}
              className="text-[12.5px] text-accent-ink underline-offset-4 hover:underline"
            >
              {d.auth.forgot}
            </Link>
          }
        >
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>

        {state?.message && (
          <Alert tone="danger">
            {state.message === "network" ? d.errors.network : state.message}
            {state.requiresVerification && state.email && (
              <>
                {" "}
                <Link
                  href={path(`/verify-email?email=${encodeURIComponent(state.email)}`, locale)}
                  className="font-medium text-accent-ink underline underline-offset-4"
                >
                  {d.auth.verifyTitle}
                </Link>
              </>
            )}
          </Alert>
        )}

        <Submit label={d.auth.submitSignIn} pending={pending} />
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-3">
        {d.auth.noAccount}{" "}
        <Link href={path("/register", locale)} className="font-medium text-accent-ink underline-offset-4 hover:underline">
          {d.auth.signUp}
        </Link>
      </p>
    </div>
  );
}

/* ================================= sign up ================================= */

export function SignUpForm({ action, locale, d }: { action: Action; locale: Locale; d: Dictionary }) {
  const [state, formAction, pending] = React.useActionState(action, null);

  return (
    <div>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-[-0.035em]">{d.auth.signUpTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{d.auth.signUpBody}</p>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />

        <Field label={d.auth.name} htmlFor="name" required>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>

        <Field label={d.auth.email} htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state?.email}
            required
          />
        </Field>

        <Field
          label={d.auth.password}
          htmlFor="password"
          required
          hint="8+ · A-z · 0-9"
        >
          <PasswordInput id="password" name="password" autoComplete="new-password" required />
        </Field>

        {state?.message && <Alert tone="danger">{state.message === "network" ? d.errors.network : state.message}</Alert>}

        <Submit label={d.auth.submitSignUp} pending={pending} />
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-3">
        {d.auth.hasAccount}{" "}
        <Link href={path("/login", locale)} className="font-medium text-accent-ink underline-offset-4 hover:underline">
          {d.auth.signIn}
        </Link>
      </p>
    </div>
  );
}

/* =============================== verify email ============================== */

export function VerifyForm({
  action,
  resend,
  locale,
  d,
  email,
}: {
  action: Action;
  resend: (email: string) => Promise<AuthResult>;
  locale: Locale;
  d: Dictionary;
  email: string;
}) {
  const [state, formAction, pending] = React.useActionState(action, null);
  const [sending, setSending] = React.useState(false);
  const { push } = useToast();

  async function resendCode() {
    setSending(true);
    const result = await resend(email);
    setSending(false);
    push(
      result.ok
        ? { tone: "success", title: d.auth.resend }
        : { tone: "warning", title: result.message ?? d.errors.generic },
    );
  }

  return (
    <div>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-[-0.035em]">{d.auth.verifyTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{d.auth.verifyBody}</p>
      {email && <p className="mt-2 font-mono text-[13px] text-ink-2">{email}</p>}

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="email" value={email} />

        <Field label={d.auth.code} htmlFor="code" required>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="text-center font-mono text-[22px] tracking-[0.4em]"
            required
          />
        </Field>

        {state?.message && <Alert tone="danger">{state.message === "network" ? d.errors.network : state.message}</Alert>}

        <Submit label={d.common.next} pending={pending} />
      </form>

      <div className="mt-6 text-center">
        <Button variant="link" onClick={resendCode} loading={sending}>
          {d.auth.resend}
        </Button>
      </div>
    </div>
  );
}

/* ============================== password reset ============================= */

export function ForgotForm({ action, locale, d }: { action: Action; locale: Locale; d: Dictionary }) {
  const [state, formAction, pending] = React.useActionState(action, null);

  return (
    <div>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-[-0.035em]">{d.auth.resetTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{d.auth.resetBody}</p>

      {state?.ok ? (
        <div className="mt-8">
          <Alert tone="success">{d.auth.verifyBody}</Alert>
          <Link
            href={path("/login", locale)}
            className="mt-6 inline-block text-[13.5px] font-medium text-accent-ink underline-offset-4 hover:underline"
          >
            {d.auth.signIn}
          </Link>
        </div>
      ) : (
        <form action={formAction} className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <Field label={d.auth.email} htmlFor="email" required>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </Field>
          <Submit label={d.common.next} pending={pending} />
        </form>
      )}
    </div>
  );
}

export function ResetForm({
  action,
  locale,
  d,
  token,
}: {
  action: Action;
  locale: Locale;
  d: Dictionary;
  token: string;
}) {
  const [state, formAction, pending] = React.useActionState(action, null);

  return (
    <div>
      <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-[-0.035em]">{d.auth.resetTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{d.auth.passwordRepeat}</p>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <Field label={d.auth.password} htmlFor="password" required hint="8+ · A-z · 0-9">
          <PasswordInput id="password" name="password" autoComplete="new-password" required />
        </Field>
        {state?.message && <Alert tone="danger">{state.message === "network" ? d.errors.network : state.message}</Alert>}
        <Submit label={d.common.save} pending={pending} />
      </form>
    </div>
  );
}
