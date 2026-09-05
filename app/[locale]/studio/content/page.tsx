import { AlertTriangle, Languages } from "lucide-react";
import { StudioPage } from "@/components/studio/studio-shell";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { legalEntity, legalIsDraft, legalValue } from "@/content/site";
import { getAllBlogPosts, getCalendar } from "@/lib/api/public";
import { getStudioDashboard } from "@/lib/api/studio";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";

export default async function StudioContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const [dashboard, posts, events] = await Promise.all([
    getStudioDashboard(),
    getAllBlogPosts(locale),
    getCalendar(locale),
  ]);
  if (!dashboard) return null;

  const ru = posts.filter((post) => post.lang === "ru").length;
  const ukr = posts.filter((post) => post.lang === "ukr").length;
  const withoutBody = posts.filter((post) => !post.body).length;

  const missingRequisites = [
    { key: "legalName", value: legalEntity.legalName },
    { key: "registrationNumber", value: legalEntity.registrationNumber },
    { key: "taxId", value: legalEntity.taxId },
    { key: "address", value: legalEntity.address },
    { key: "iban", value: legalEntity.iban },
    { key: "governingLaw", value: legalEntity.governingLaw },
  ].filter((row) => legalValue(row.value) === null);

  return (
    <StudioPage
      title={pick(locale, "Контент", "Content")}
      body={pick(
        locale,
        "Журнал, календарь событий и юридические документы — с проверкой готовности.",
        "The journal, the events calendar and the legal documents — with a readiness check.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Материалов", "Articles")} value={formatNumber(posts.length, locale)} />
        <StatTile label="RU" value={formatNumber(ru, locale)} hint={pick(locale, "написаны по-русски", "written in Russian")} />
        <StatTile label="UA" value={formatNumber(ukr, locale)} hint={pick(locale, "написаны по-украински", "written in Ukrainian")} />
        <StatTile
          label={pick(locale, "Без полного текста", "Without a body")}
          value={formatNumber(withoutBody, locale)}
          tone={withoutBody > 0 ? "warning" : "good"}
        />
      </section>

      {withoutBody > 0 && (
        <Note tone="warning" className="mb-6">
          <span className="inline-flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            {pick(
              locale,
              `У ${withoutBody} материалов есть только лид. Раньше недостающий текст подменялся одинаковым шаблоном для всех статей — сейчас страница честно показывает, что полная версия готовится.`,
              `${withoutBody} articles only have a lead. The previous build substituted one identical template body for all of them; the page now says plainly that the full version is in preparation.`,
            )}
          </span>
        </Note>
      )}

      {legalIsDraft && (
        <Note tone="warning" className="mb-6">
          <span className="inline-flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            {pick(
              locale,
              `Не заполнено реквизитов: ${missingRequisites.length}. До их публикации боевые платежи должны оставаться выключенными.`,
              `${missingRequisites.length} registration fields are empty. Live payments must stay off until they are published.`,
            )}
          </span>
        </Note>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title={pick(locale, "Журнал", "Journal")}>
          <DataTable
            caption={pick(locale, "Материалы блога", "Blog articles")}
            columns={[
              { key: "title", label: pick(locale, "Заголовок", "Title") },
              { key: "lang", label: pick(locale, "Язык", "Language") },
              { key: "body", label: pick(locale, "Текст", "Body") },
              { key: "date", label: pick(locale, "Дата", "Date"), align: "right" },
            ]}
            empty={pick(locale, "Материалов нет", "No articles")}
          >
            {posts.slice(0, 40).map((post) => (
              <Row key={post.id}>
                <Cell strong>{post.title}</Cell>
                <Cell>
                  <Badge tone={post.lang === "ru" ? "neutral" : "accent"}>{post.lang === "ru" ? "RU" : "UA"}</Badge>
                </Cell>
                <Cell>
                  <Badge tone={post.body ? "success" : "warning"}>
                    {post.body ? pick(locale, "есть", "yes") : pick(locale, "нет", "no")}
                  </Badge>
                </Cell>
                <Cell align="right" mono>
                  {formatDate(post.date, locale, { day: "numeric", month: "short", year: "numeric" })}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "Реквизиты", "Registration details")}>
            {missingRequisites.length ? (
              <ul className="flex flex-col gap-2">
                {missingRequisites.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[12px] text-ink-2">{row.key}</span>
                    <Badge tone="warning">{pick(locale, "пусто", "empty")}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-success">{pick(locale, "Все поля заполнены", "All fields are filled in")}</p>
            )}
          </Panel>

          <Panel title={pick(locale, "Календарь", "Calendar")}>
            {events.length ? (
              <ul className="flex flex-col gap-2.5">
                {events.slice(0, 8).map((event) => (
                  <li key={event.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] text-ink-2">{event.title}</span>
                    <span className="shrink-0 font-mono text-[12px] text-muted">
                      {formatDate(event.date, locale, { day: "numeric", month: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">
                <Languages className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
                {pick(locale, "Событий нет", "No events")}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </StudioPage>
  );
}
