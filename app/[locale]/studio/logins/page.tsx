import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/field";
import { pick } from "@/content/locale";
import { canOpen, getLogins, getStudioDashboard } from "@/lib/api/studio";
import { formatDate, formatNumber, path, type Locale } from "@/lib/i18n";

/** Who signed in, under which account and when — newest first. */
export default async function StudioLoginsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const title = pick(locale, "Входы в аккаунты", "Sign-ins");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "logins")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const q = ((await searchParams).q ?? "").trim();
  const data = await getLogins({ q });

  const METHOD: Record<string, string> = {
    password: pick(locale, "пароль", "password"),
    google: "Google",
    apple: "Apple",
    email_code: pick(locale, "код из письма", "email code"),
    email_link: pick(locale, "ссылка из письма", "email link"),
    test: pick(locale, "тестовый вход", "test login"),
  };

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Каждый вход: под каким аккаунтом (ID и личный ID), когда, каким способом и с какого адреса. Записи хранятся 180 дней.",
        "Every sign-in: which account (id and personal id), when, how and from which address. Kept for 180 days.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label={pick(locale, "Входов за 24 часа", "Sign-ins, 24 h")} value={formatNumber(data.last24h.logins, locale)} />
        <StatTile label={pick(locale, "Людей за 24 часа", "People, 24 h")} value={formatNumber(data.last24h.people, locale)} />
        <StatTile label={pick(locale, "Людей за 7 дней", "People, 7 days")} value={formatNumber(data.last7d.people, locale)} />
      </section>

      <form className="mb-4 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder={pick(locale, "Email, ID аккаунта или личный ID", "Email, account id or personal id")} aria-label={pick(locale, "Поиск", "Search")} />
        <Button type="submit">{pick(locale, "Найти", "Search")}</Button>
      </form>

      <Panel title={q ? pick(locale, `Найдено: ${data.logins.length}`, `Found: ${data.logins.length}`) : pick(locale, "Последние входы", "Latest sign-ins")}>
        <DataTable
          caption={title}
          columns={[
            { key: "when", label: pick(locale, "Когда", "When") },
            { key: "id", label: pick(locale, "Аккаунт", "Account") },
            { key: "personal", label: pick(locale, "Личный ID", "Personal id") },
            { key: "email", label: "Email" },
            { key: "how", label: pick(locale, "Как", "How") },
            { key: "ip", label: pick(locale, "Адрес", "Address"), align: "right" },
          ]}
          empty={pick(locale, "Входов пока не записано — журнал ведётся с этого обновления.", "No sign-ins recorded yet — the log starts with this update.")}
        >
          {data.logins.map((login) => (
            <Row key={login.id}>
              <Cell mono>{formatDate(login.at, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Cell>
              <Cell mono>
                {login.userId ? (
                  <Link href={path(`/studio/learners/${login.userId}`, locale)} className="underline-offset-4 hover:underline">
                    #{login.userId}
                  </Link>
                ) : (
                  "—"
                )}
              </Cell>
              <Cell mono>{login.personalId ?? "—"}</Cell>
              <Cell mono>{login.email ?? "—"}</Cell>
              <Cell>
                <Badge tone="outline">{METHOD[login.method] ?? login.method}</Badge>
              </Cell>
              <Cell align="right" mono>
                <span title={login.userAgent ?? ""}>{login.ip ?? "—"}</span>
              </Cell>
            </Row>
          ))}
        </DataTable>
      </Panel>
    </StudioPage>
  );
}
