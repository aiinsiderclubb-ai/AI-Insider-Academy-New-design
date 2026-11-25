import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { LinkReferralForm, UnlinkReferralButton } from "@/components/studio/referral-controls";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/field";
import { pick } from "@/content/locale";
import { canOpen, getReferralList, getReferralStats, getStudioDashboard } from "@/lib/api/studio";
import { formatDate, formatNumber, path, type Locale } from "@/lib/i18n";

/**
 * The referral programme: each learner's personal id is their invite code.
 * A friend who arrives by it gets 10% off the first purchase; once that
 * purchase is past the refund window, the inviter gets a single-use −15% code.
 */
export default async function StudioReferralsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const title = pick(locale, "Реферальная программа", "Referral programme");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "referrals")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const q = ((await searchParams).q ?? "").trim();
  const [stats, list] = await Promise.all([getReferralStats(), getReferralList(q)]);
  const rows = list.referrals;

  const REWARD: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "accent" }> = {
    active: { label: pick(locale, "код действует", "code active"), tone: "success" },
    pending: { label: pick(locale, "код ждёт 14 дней", "code waits 14 days"), tone: "accent" },
    used: { label: pick(locale, "код использован", "code used"), tone: "neutral" },
    expired: { label: pick(locale, "код истёк", "code expired"), tone: "neutral" },
    cancelled: { label: pick(locale, "код отменён", "code cancelled"), tone: "warning" },
  };

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Личный ID ученика — его реферальный код (ссылка вида /store?ref=AIA-…). Друг получает −10% на первую покупку, пригласивший — одноразовый код −15% через 14 дней после покупки друга. Возврат отменяет награду.",
        "A learner's personal id is their referral code (a link like /store?ref=AIA-…). The friend gets 10% off the first purchase; the inviter gets a single-use 15% code 14 days after the friend buys. A refund cancels the reward.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Пришли по ссылкам", "Came by referral")} value={formatNumber(stats?.invited ?? 0, locale)} />
        <StatTile
          label={pick(locale, "Из них купили", "Of them bought")}
          value={formatNumber(stats?.converted ?? 0, locale)}
          hint={stats?.invited ? `${Math.round(((stats.converted ?? 0) / stats.invited) * 100)}%` : undefined}
        />
        <StatTile label={pick(locale, "Кодов наград выдано", "Reward codes issued")} value={formatNumber(stats?.friendCodes.issued ?? 0, locale)} />
        <StatTile label={pick(locale, "Наград использовано", "Rewards used")} value={formatNumber(stats?.friendCodes.used ?? 0, locale)} />
      </section>

      <Panel title={pick(locale, "Привязать вручную", "Link by hand")} className="mb-6">
        <LinkReferralForm locale={locale} />
        <p className="mt-3 text-[12.5px] text-muted">
          {pick(
            locale,
            "Когда друг зарегистрировался не по ссылке (другое устройство, потерялась метка). Если он уже купил, награда пригласившему не начислится автоматически — выдайте персональный промокод в «Рост и промокоды».",
            "When the friend signed up without the link (another device, the tag got lost). If they already bought, the inviter's reward is not issued automatically — give a personal promo code in Growth.",
          )}
        </p>
      </Panel>

      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={q ? pick(locale, `Найдено: ${rows.length}`, `Found: ${rows.length}`) : pick(locale, "Все приглашения", "Every invitation")}>
          <form className="mb-4 flex max-w-md gap-2">
            <Input name="q" defaultValue={q} placeholder={pick(locale, "Email или код", "Email or code")} aria-label={pick(locale, "Поиск", "Search")} />
            <Button type="submit" variant="secondary">{pick(locale, "Найти", "Search")}</Button>
          </form>
          <DataTable
            caption={title}
            columns={[
              { key: "date", label: pick(locale, "Дата", "Date") },
              { key: "from", label: pick(locale, "Пригласил", "Inviter") },
              { key: "to", label: pick(locale, "Пришёл", "Newcomer") },
              { key: "state", label: pick(locale, "Статус", "Status") },
              { key: "actions", label: "", align: "right" },
            ]}
            empty={pick(locale, "Приглашений пока нет", "No invitations yet")}
          >
            {rows.map((row) => (
              <Row key={row.id}>
                <Cell mono>{formatDate(row.date, locale, { day: "numeric", month: "short", year: "2-digit" })}</Cell>
                <Cell mono>
                  {row.referrerId ? (
                    <Link href={path(`/studio/learners/${row.referrerId}`, locale)} className="underline-offset-4 hover:underline">
                      {row.referrerEmail}
                    </Link>
                  ) : (
                    row.referrerEmail
                  )}
                  {row.referrerCode ? <span className="ml-1.5 text-[11px] text-muted">{row.referrerCode}</span> : null}
                </Cell>
                <Cell mono>
                  {row.referredId ? (
                    <Link href={path(`/studio/learners/${row.referredId}`, locale)} className="underline-offset-4 hover:underline">
                      {row.referredEmail}
                    </Link>
                  ) : (
                    row.referredEmail
                  )}
                </Cell>
                <Cell>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={row.purchased ? "success" : "neutral"}>{row.purchased ? pick(locale, "купил", "bought") : pick(locale, "не купил", "not yet")}</Badge>
                    {row.reward.status && REWARD[row.reward.status] ? (
                      <Badge tone={REWARD[row.reward.status].tone}>{REWARD[row.reward.status].label}</Badge>
                    ) : null}
                  </span>
                </Cell>
                <Cell align="right">
                  <UnlinkReferralButton locale={locale} id={row.id} label={row.referredEmail} />
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>

        <Panel title={pick(locale, "Кто приводит людей", "Who brings people in")}>
          <DataTable
            caption={pick(locale, "Топ пригласивших", "Top referrers")}
            columns={[
              { key: "email", label: "Email" },
              { key: "invited", label: pick(locale, "Пришли", "Came"), align: "right" },
              { key: "converted", label: pick(locale, "Купили", "Bought"), align: "right" },
            ]}
            empty={pick(locale, "Рефералов пока нет", "No referrals yet")}
          >
            {(stats?.topReferrers ?? []).map((row) => (
              <Row key={row.email}>
                <Cell mono>{row.email}</Cell>
                <Cell align="right" mono>{row.invited}</Cell>
                <Cell align="right" mono>{row.converted}</Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>
      </div>
    </StudioPage>
  );
}
