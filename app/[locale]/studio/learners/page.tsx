import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/field";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { pick } from "@/content/locale";
import { canOpen, getStudioDashboard, searchUsers } from "@/lib/api/studio";
import { deleteLearner } from "@/lib/api/studio-actions";
import { DeleteLearnerButton } from "@/components/studio/people-controls";
import { formatDate, formatNumber, formatPrice, formatRelative, getDictionary, path, type Locale } from "@/lib/i18n";

export default async function StudioLearnersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const title = pick(locale, "Ученики", "Learners");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "learners")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const q = ((await searchParams).q ?? "").trim();
  const found = await searchUsers(q);

  const users = dashboard.users ?? [];
  const verified = users.filter((user) => user.emailVerified).length;
  const withTelegram = users.filter((user) => user.telegramChatId).length;
  const teams = dashboard.teams ?? [];
  const isAdmin = dashboard.role === "admin";

  async function handleDelete(userId: number) {
    "use server";
    return deleteLearner(locale, userId);
  }

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Найдите человека по email, имени, ID аккаунта или личному ID — увидите покупки и тариф, входы, рефералов и коды, сможете выдать доступ, временный пароль или удалить аккаунт.",
        "Find a person to see their purchases, access, referrals and codes — and grant or revoke access.",
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

      <form className="mb-4 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder={pick(locale, "Email, имя или ID ученика", "Email, name or learner ID")} aria-label={pick(locale, "Поиск", "Search")} />
        <Button type="submit">{pick(locale, "Найти", "Search")}</Button>
      </form>

      <Panel title={q ? pick(locale, `Найдено: ${found.users.length}`, `Found: ${found.users.length}`) : pick(locale, "Последние аккаунты", "Latest accounts")} className="mb-6">
        <DataTable
          caption={title}
          columns={[
            { key: "name", label: pick(locale, "Имя", "Name") },
            { key: "email", label: "Email" },
            { key: "id", label: "ID" },
            { key: "state", label: pick(locale, "Статус", "State") },
            { key: "bought", label: pick(locale, "Покупки", "Purchases"), align: "right" },
            { key: "since", label: pick(locale, "С нами с", "Joined"), align: "right" },
            { key: "seen", label: pick(locale, "Последний вход", "Last sign-in"), align: "right" },
            { key: "actions", label: "", align: "right" },
          ]}
          empty={q ? pick(locale, "Никого не нашли", "Nobody found") : pick(locale, "Аккаунтов пока нет", "No accounts yet")}
        >
          {found.users.map((user) => (
            <Row key={user.id}>
              <Cell strong>
                <Link href={path(`/studio/learners/${user.id}`, locale)} className="underline-offset-4 hover:underline">
                  {user.name || "—"}
                </Link>
              </Cell>
              <Cell mono>
                <Link href={path(`/studio/learners/${user.id}`, locale)} className="underline-offset-4 hover:underline">
                  {user.email}
                </Link>
              </Cell>
              <Cell mono>{user.personalId ?? "—"}</Cell>
              <Cell>
                <Badge tone={user.emailVerified ? "success" : "warning"}>
                  {user.emailVerified ? pick(locale, "подтверждён", "verified") : pick(locale, "не подтверждён", "unverified")}
                </Badge>
              </Cell>
              <Cell align="right" mono>
                {user.purchases}
                {user.paid ? ` · ${formatPrice(user.paid, locale)}` : ""}
              </Cell>
              <Cell align="right" mono>
                {user.createdAt ? formatDate(user.createdAt, locale, { day: "numeric", month: "short", year: "2-digit" }) : "—"}
              </Cell>
              <Cell align="right" mono>
                {user.lastLoginAt ? formatRelative(user.lastLoginAt, locale) : "—"}
              </Cell>
              <Cell align="right">
                {isAdmin && (
                  <DeleteLearnerButton
                    compact
                    locale={locale}
                    d={d}
                    email={user.email}
                    backHref={path("/studio/learners", locale)}
                    onDelete={handleDelete.bind(null, user.id)}
                  />
                )}
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
