import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { GiveawayControls, PromoManager, type PromoCode } from "@/components/studio/ops-controls";
import { giveawayList } from "@/content/community";
import { pick } from "@/content/locale";
import { getGiveaways } from "@/lib/api/public";
import { canOpen, getPromoCodes, getReferralStats, getStudioDashboard, studioItemOptions, type CodeTally } from "@/lib/api/studio";
import { createPromoCode, drawGiveaway, publishGiveaway, togglePromoCode, type PromoInput } from "@/lib/api/studio-actions";
import { formatNumber, getDictionary, type Locale } from "@/lib/i18n";

const tallyRows = (label: string, tally: CodeTally | undefined) => ({ label, tally });

export default async function StudioGrowthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const title = pick(locale, "Рост и промокоды", "Growth and promos");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "growth")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const [promoPayload, live, referrals, items] = await Promise.all([
    getPromoCodes(),
    getGiveaways(),
    getReferralStats(),
    studioItemOptions(locale),
  ]);
  const codes = (Array.isArray(promoPayload) ? promoPayload : (promoPayload.codes ?? [])) as PromoCode[];
  const campaigns = codes.filter((code) => (code.kind ?? "campaign") === "campaign");

  const liveBySlug = new Map(live.map((item) => [item.slug, item]));
  const giveaways = giveawayList.map((giveaway) => ({
    slug: giveaway.slug,
    title: pick(locale, giveaway.prizeRu, giveaway.prizeEn),
    status: liveBySlug.get(giveaway.slug)?.status ?? giveaway.status,
    participants: liveBySlug.get(giveaway.slug)?.participantCount ?? 0,
  }));

  async function handleCreate(input: PromoInput) {
    "use server";
    return createPromoCode(locale, input);
  }
  async function handleToggle(code: string, active: boolean) {
    "use server";
    return togglePromoCode(locale, code, active);
  }
  async function handleDraw(slug: string) {
    "use server";
    return drawGiveaway(locale, slug);
  }
  async function handlePublish(slug: string) {
    "use server";
    return publishGiveaway(locale, slug);
  }

  const codeRows = referrals
    ? [
        tallyRows(pick(locale, "FRIEND −15% пригласившим", "FRIEND −15% for inviters"), referrals.friendCodes),
        tallyRows(pick(locale, "NEXT −15% на следующую покупку", "NEXT −15% next purchase"), referrals.nextCodes),
        tallyRows(pick(locale, "THANKS −10% за отзыв", "THANKS −10% for a review"), referrals.reviewCodes),
      ]
    : [];

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Промокоды кампаний, реферальная программа (другу −10%, пригласившему −15%) и розыгрыши.",
        "Campaign promo codes, the referral programme (10% off for the friend, 15% for the inviter) and giveaways.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Промокодов кампаний", "Campaign codes")} value={formatNumber(campaigns.length, locale)} />
        <StatTile label={pick(locale, "Пришли по ссылкам", "Came by referral")} value={formatNumber(referrals?.invited ?? 0, locale)} />
        <StatTile
          label={pick(locale, "Из них купили", "Of them bought")}
          value={formatNumber(referrals?.converted ?? 0, locale)}
          hint={referrals?.invited ? `${Math.round(((referrals.converted ?? 0) / referrals.invited) * 100)}%` : undefined}
        />
        <StatTile label={pick(locale, "Розыгрышей", "Giveaways")} value={formatNumber(giveaways.length, locale)} />
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "Промокоды", "Promo codes")}>
            <PromoManager locale={locale} d={d} codes={codes} items={items} onCreate={handleCreate} onToggle={handleToggle} />
          </Panel>

          <Panel title={pick(locale, "Розыгрыши", "Giveaways")}>
            <GiveawayControls locale={locale} d={d} giveaways={giveaways} onDraw={handleDraw} onPublish={handlePublish} />
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "Коды наград", "Reward codes")}>
            <ul className="flex flex-col gap-3">
              {codeRows.map((row) => (
                <li key={row.label} className="rounded-md border border-line bg-surface-2 p-3">
                  <p className="text-[13px] font-medium text-ink">{row.label}</p>
                  <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-3">
                    {pick(locale, "выдано", "issued")} {row.tally?.issued ?? 0} · {pick(locale, "действуют", "active")} {row.tally?.active ?? 0} ·{" "}
                    {pick(locale, "ждут", "pending")} {row.tally?.pending ?? 0} · {pick(locale, "использ.", "used")} {row.tally?.used ?? 0}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {pick(
                locale,
                "«Ждут» — коды пригласивших, которые включатся через 14 дней после покупки друга. Возврат отменяет коды заказа.",
                "“Pending” are inviter codes that switch on 14 days after the friend’s purchase. A refund cancels an order’s codes.",
              )}
            </p>
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
              {(referrals?.topReferrers ?? []).map((row) => (
                <Row key={row.email}>
                  <Cell mono>{row.email}</Cell>
                  <Cell align="right" mono>{row.invited}</Cell>
                  <Cell align="right" mono>{row.converted}</Cell>
                </Row>
              ))}
            </DataTable>
          </Panel>
        </div>
      </div>
    </StudioPage>
  );
}
