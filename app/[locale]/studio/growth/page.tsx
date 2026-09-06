import { StudioPage } from "@/components/studio/studio-shell";
import { Panel, StatTile } from "@/components/studio/tiles";
import { GiveawayControls, PromoManager, type PromoCode } from "@/components/studio/ops-controls";
import { RankedBars } from "@/components/studio/charts";
import { giveawayList } from "@/content/community";
import { pick } from "@/content/locale";
import { getGiveaways } from "@/lib/api/public";
import { getPromoCodes, getStudioDashboard } from "@/lib/api/studio";
import { createPromoCode, drawGiveaway, publishGiveaway, togglePromoCode } from "@/lib/api/studio-actions";
import { formatNumber, getDictionary, type Locale } from "@/lib/i18n";

export default async function StudioGrowthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [dashboard, promoPayload, live] = await Promise.all([getStudioDashboard(), getPromoCodes(), getGiveaways()]);
  if (!dashboard) return null;

  const codes = (Array.isArray(promoPayload) ? promoPayload : (promoPayload.codes ?? [])) as PromoCode[];
  const referrals = dashboard.referrals ?? [];
  const discounts = Object.entries(dashboard.discounts ?? {});

  const liveBySlug = new Map(live.map((item) => [item.slug, item]));
  const giveaways = giveawayList.map((giveaway) => ({
    slug: giveaway.slug,
    title: pick(locale, giveaway.prizeRu, giveaway.prizeEn),
    status: liveBySlug.get(giveaway.slug)?.status ?? giveaway.status,
    participants: liveBySlug.get(giveaway.slug)?.participantCount ?? 0,
  }));

  const topReferrers = Object.entries(
    referrals.reduce<Record<string, number>>((acc, referral) => {
      acc[referral.referrer_email] = (acc[referral.referrer_email] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  async function handleCreate(input: { code: string; percent?: number; maxUses?: number }) {
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

  return (
    <StudioPage
      title={pick(locale, "Рост", "Growth")}
      body={pick(
        locale,
        "Промокоды, розыгрыши и реферальная механика — рычаги, которые двигают выручку.",
        "Promo codes, giveaways and referrals — the levers that move revenue.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Промокодов", "Promo codes")} value={formatNumber(codes.length, locale)} />
        <StatTile label={pick(locale, "Розыгрышей", "Giveaways")} value={formatNumber(giveaways.length, locale)} />
        <StatTile label={pick(locale, "Рефералов", "Referrals")} value={formatNumber(referrals.length, locale)} />
        <StatTile
          label={pick(locale, "Активных скидок", "Active discounts")}
          value={formatNumber(discounts.length, locale)}
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "Промокоды", "Promo codes")}>
            <PromoManager locale={locale} d={d} codes={codes} onCreate={handleCreate} onToggle={handleToggle} />
          </Panel>

          <Panel title={pick(locale, "Розыгрыши", "Giveaways")}>
            <GiveawayControls
              locale={locale}
              d={d}
              giveaways={giveaways}
              onDraw={handleDraw}
              onPublish={handlePublish}
            />
          </Panel>
        </div>

        <Panel title={pick(locale, "Кто приводит людей", "Who brings people in")}>
          {topReferrers.length ? (
            <RankedBars rows={topReferrers} locale={locale} format="number" />
          ) : (
            <p className="text-[13px] text-muted">{pick(locale, "Рефералов пока нет", "No referrals yet")}</p>
          )}
        </Panel>
      </div>
    </StudioPage>
  );
}
