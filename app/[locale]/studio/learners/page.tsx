import { StudioPage } from "@/components/studio/studio-shell";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { pick } from "@/content/locale";
import { getStudioDashboard } from "@/lib/api/studio";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";

export default async function StudioLearnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;

  const users = dashboard.users ?? [];
  const verified = users.filter((user) => user.emailVerified).length;
  const withTelegram = users.filter((user) => user.telegramChatId).length;
  const teams = dashboard.teams ?? [];

  return (
    <StudioPage
      title={pick(locale, "Ученики", "Learners")}
      body={pick(
        locale,
        "Аккаунты, подтверждение почты, привязка Telegram и корпоративные команды.",
        "Accounts, email confirmation, Telegram links and corporate teams.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Аккаунтов", "Accounts")} value={formatNumber(users.length, locale)} />
        <StatTile
          label={pick(locale, "Почта подтверждена", "Email confirmed")}
          value={formatNumber(verified, locale)}
          hint={users.length ? `${Math.round((verified / users.length) * 100)}%` : undefined}
          tone={verified === users.length && users.length > 0 ? "good" : "neutral"}
        />
        <StatTile label={pick(locale, "Telegram привязан", "Telegram linked")} value={formatNumber(withTelegram, locale)} />
        <StatTile label={pick(locale, "Команд", "Teams")} value={formatNumber(teams.length, locale)} />
      </section>

      <Panel title={pick(locale, "Последние аккаунты", "Latest accounts")} className="mb-6">
        <DataTable
          caption={pick(locale, "Ученики", "Learners")}
          columns={[
            { key: "name", label: pick(locale, "Имя", "Name") },
            { key: "email", label: "Email" },
            { key: "id", label: "ID" },
            { key: "state", label: pick(locale, "Статус", "State") },
            { key: "last", label: pick(locale, "Последний вход", "Last seen"), align: "right" },
          ]}
          empty={pick(locale, "Аккаунтов пока нет", "No accounts yet")}
        >
          {users.slice(0, 60).map((user) => (
            <Row key={user.id}>
              <Cell strong>{user.name || "—"}</Cell>
              <Cell mono>{user.email}</Cell>
              <Cell mono>{user.personalId ?? "—"}</Cell>
              <Cell>
                <span className="flex flex-wrap gap-1.5">
                  <Badge tone={user.emailVerified ? "success" : "warning"}>
                    {user.emailVerified ? pick(locale, "подтверждён", "verified") : pick(locale, "не подтверждён", "unverified")}
                  </Badge>
                  {user.telegramChatId && <Badge tone="neutral">TG</Badge>}
                </span>
              </Cell>
              <Cell align="right" mono>
                {user.lastLoginAt ? formatDate(user.lastLoginAt, locale, { day: "numeric", month: "short" }) : "—"}
              </Cell>
            </Row>
          ))}
        </DataTable>
      </Panel>

      {teams.length > 0 && (
        <Panel title={pick(locale, "Команды", "Teams")}>
          <DataTable
            caption={pick(locale, "Команды", "Teams")}
            columns={[
              { key: "name", label: pick(locale, "Название", "Name") },
              { key: "code", label: pick(locale, "Код", "Code") },
              { key: "created", label: pick(locale, "Создана", "Created"), align: "right" },
            ]}
            empty={pick(locale, "Команд нет", "No teams")}
          >
            {teams.map((team) => (
              <Row key={team.id}>
                <Cell strong>{team.name}</Cell>
                <Cell mono>{team.invite_code}</Cell>
                <Cell align="right" mono>
                  {formatDate(team.created_at, locale, { day: "numeric", month: "short", year: "numeric" })}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>
      )}
    </StudioPage>
  );
}
