import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { pick } from "@/content/locale";
import { canOpen, getFreeViews, getStudioDashboard, type FreeViewRow } from "@/lib/api/studio";
import { formatNumber, formatRelative, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;

/** Who looks at the free material: free courses, and the demo lesson of every paid one. */
export default async function StudioFreeViewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const title = pick(locale, "Бесплатные просмотры", "Free views");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "free")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const requested = Number((await searchParams).days);
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const data = await getFreeViews(days);
  const free = data?.free ?? [];
  const demos = data?.demos ?? [];
  const sum = (rows: FreeViewRow[], key: keyof FreeViewRow) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);

  const table = (rows: FreeViewRow[], caption: string, startedLabel: string) => (
    <DataTable
      caption={caption}
      columns={[
        { key: "course", label: pick(locale, "Курс", "Course") },
        { key: "visitors", label: pick(locale, "Людей", "People"), align: "right" },
        { key: "accounts", label: pick(locale, "Из них с аккаунтом", "With an account"), align: "right" },
        { key: "views", label: pick(locale, "Просмотров", "Views"), align: "right" },
        { key: "started", label: startedLabel, align: "right" },
      ]}
      empty={pick(locale, "Пока пусто", "Nothing yet")}
    >
      {rows.map((row) => (
        <Row key={row.id}>
          <Cell strong>{row.title}</Cell>
          <Cell align="right" mono>{formatNumber(row.visitors, locale)}</Cell>
          <Cell align="right" mono>{formatNumber(row.accounts, locale)}</Cell>
          <Cell align="right" mono>{formatNumber(row.views, locale)}</Cell>
          <Cell align="right" mono>{formatNumber(row.started, locale)}</Cell>
        </Row>
      ))}
    </DataTable>
  );

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Сколько людей смотрели бесплатные курсы и бесплатный первый урок платных. «Людей» — уникальные посетители за день (гости тоже), «с аккаунтом» — вошедшие в аккаунт.",
        "How many people watched the free courses and the free first lesson of paid ones. “People” are unique daily visitors (guests included); “with an account” were signed in.",
      )}
      action={
        <nav aria-label={pick(locale, "Период", "Period")} className="flex gap-1.5">
          {PERIODS.map((period) => (
            <Link
              key={period}
              href={path(`/studio/free?days=${period}`, locale)}
              aria-current={days === period ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                days === period ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink",
              )}
            >
              {period} {pick(locale, "дн.", "days")}
            </Link>
          ))}
        </nav>
      }
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Смотрели бесплатные курсы", "Watched free courses")} value={formatNumber(sum(free, "visitors"), locale)} hint={`${days} ${pick(locale, "дн.", "days")}`} />
        <StatTile label={pick(locale, "Начали бесплатный курс", "Started a free course")} value={formatNumber(sum(free, "started"), locale)} hint={pick(locale, "за всё время", "all time")} />
        <StatTile label={pick(locale, "Открыли демо-урок", "Opened a demo lesson")} value={formatNumber(sum(demos, "visitors"), locale)} hint={`${days} ${pick(locale, "дн.", "days")}`} />
        <StatTile label={pick(locale, "Запустили таймер демо", "Started the demo clock")} value={formatNumber(sum(demos, "started"), locale)} hint={pick(locale, "за всё время", "all time")} />
      </section>

      <div className="flex flex-col gap-3">
        <Panel title={pick(locale, "Бесплатные курсы", "Free courses")}>
          {table(free, pick(locale, "Бесплатные курсы", "Free courses"), pick(locale, "Начали (всего)", "Started (all time)"))}
        </Panel>
        <Panel title={pick(locale, "Демо-уроки платных курсов", "Demo lessons of paid courses")}>
          {table(demos, pick(locale, "Демо-уроки", "Demo lessons"), pick(locale, "Таймер демо (всего)", "Demo clock (all time)"))}
        </Panel>
        <Panel title={pick(locale, "Кто из учеников смотрел бесплатное", "Learners who watched free courses")}>
          <DataTable
            caption={pick(locale, "Ученики", "Learners")}
            columns={[
              { key: "who", label: pick(locale, "Аккаунт", "Account") },
              { key: "id", label: pick(locale, "Личный ID", "Personal id") },
              { key: "views", label: pick(locale, "Просмотров", "Views"), align: "right" },
              { key: "seen", label: pick(locale, "Последний раз", "Last seen"), align: "right" },
            ]}
            empty={pick(locale, "Вошедших в аккаунт зрителей пока нет", "No signed-in viewers yet")}
          >
            {(data?.people ?? []).map((person) => (
              <Row key={person.userId}>
                <Cell mono>
                  <Link href={path(`/studio/learners/${person.userId}`, locale)} className="underline-offset-4 hover:underline">
                    #{person.userId} · {person.email}
                  </Link>
                </Cell>
                <Cell mono>{person.personalId ?? "—"}</Cell>
                <Cell align="right" mono>{formatNumber(person.views, locale)}</Cell>
                <Cell align="right" mono>{formatRelative(person.lastSeen, locale)}</Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>
      </div>
    </StudioPage>
  );
}
