import { Lock } from "lucide-react";
import { StudioPage } from "@/components/studio/studio-shell";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n";

/** What a role sees on a section it may not open — instead of empty panels. */
export function NoAccess({ locale, title, role }: { locale: Locale; title: string; role?: string }) {
  return (
    <StudioPage title={title}>
      <div className="flex max-w-xl items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-ink">{pick(locale, "Нет доступа к этому разделу", "No access to this section")}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">
            {pick(
              locale,
              `Роль «${role ?? "—"}» не видит эти данные. Войдите как admin, если это нужно для работы.`,
              `The "${role ?? "—"}" role cannot see this data. Sign in as admin if you need it.`,
            )}
          </p>
        </div>
      </div>
    </StudioPage>
  );
}
