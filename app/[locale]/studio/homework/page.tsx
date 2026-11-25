import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { HomeworkQueue } from "@/components/studio/queue-board";
import { StatTile } from "@/components/studio/tiles";
import { Button } from "@/components/primitives/button";
import { Field, Input, Select } from "@/components/primitives/field";
import { pick } from "@/content/locale";
import { canOpen, getStudioDashboard } from "@/lib/api/studio";
import { reviewHomework } from "@/lib/api/studio-actions";
import { formatNumber, getDictionary, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Status = "pending" | "resubmit" | "accepted" | "all";
type Plan = "all" | "mentor" | "self" | "other";

/**
 * Homework review. Self-study learners cannot send work in (the API turns it
 * away), so what arrives here comes from the mentor plan, a subscription, or
 * access granted by hand — the badge on each item says which.
 */
export default async function StudioHomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; plan?: string; course?: string; q?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const title = pick(locale, "Проверка домашних заданий", "Homework review");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "homework")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const filters = await searchParams;
  const status: Status = (["pending", "resubmit", "accepted", "all"] as const).includes(filters.status as Status) ? (filters.status as Status) : "pending";
  const plan: Plan = (["all", "mentor", "self", "other"] as const).includes(filters.plan as Plan) ? (filters.plan as Plan) : "all";
  const course = filters.course ?? "";
  const q = (filters.q ?? "").trim().toLowerCase();

  const all = dashboard.homework ?? [];
  const courses = [...new Map(all.map((item) => [item.courseId, item.courseTitle || item.courseId])).entries()];
  const items = all
    .filter((item) => status === "all" || item.status === status)
    .filter((item) => plan === "all" || (plan === "other" ? item.plan == null : item.plan === plan))
    .filter((item) => !course || item.courseId === course)
    .filter((item) => !q || item.email.toLowerCase().includes(q) || (item.name ?? "").toLowerCase().includes(q))
    .sort((a, b) => (status === "pending" ? (a.date || "").localeCompare(b.date || "") : (b.updatedAt || "").localeCompare(a.updatedAt || "")));

  const count = (s: Exclude<Status, "all">) => all.filter((item) => item.status === s).length;
  const href = (next: Partial<Record<"status" | "plan" | "course" | "q", string>>) => {
    const qs = new URLSearchParams(
      Object.entries({ status, plan, course, q: filters.q ?? "", ...next }).filter(([, v]) => v && v !== "all") as [string, string][],
    );
    if ((next.status ?? status) === "all") qs.set("status", "all");
    if ((next.status ?? status) === "pending") qs.delete("status");
    return path(`/studio/homework${qs.toString() ? `?${qs}` : ""}`, locale);
  };

  async function handleReview(id: string, next: "accepted" | "resubmit", comment?: string) {
    "use server";
    return reviewHomework(locale, id, next, comment);
  }

  const statusTabs: { value: Status; label: string; count?: number }[] = [
    { value: "pending", label: pick(locale, "Ждут проверки", "Waiting"), count: count("pending") },
    { value: "resubmit", label: pick(locale, "На доработке", "Sent back"), count: count("resubmit") },
    { value: "accepted", label: pick(locale, "Принятые", "Accepted"), count: count("accepted") },
    { value: "all", label: pick(locale, "Все", "All"), count: all.length },
  ];

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Задания учеников тарифа «С ментором», подписчиков и тех, кому доступ выдан вручную. На тарифе «Самостоятельно» задания не сдаются — ученик сверяет работу с критериями сам.",
        "Work from mentor-plan learners, subscribers and anyone granted access by hand. Self-study learners do not submit — they check their work against the criteria themselves.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Ждут проверки", "Waiting")} value={formatNumber(count("pending"), locale)} tone={count("pending") ? "warning" : "good"} />
        <StatTile label={pick(locale, "На доработке", "Sent back")} value={formatNumber(count("resubmit"), locale)} />
        <StatTile label={pick(locale, "Принято", "Accepted")} value={formatNumber(count("accepted"), locale)} />
        <StatTile
          label={pick(locale, "С ментором среди ждущих", "Mentor plan, waiting")}
          value={formatNumber(all.filter((item) => item.status === "pending" && item.plan === "mentor").length, locale)}
        />
      </section>

      <nav aria-label={pick(locale, "Статус", "Status")} className="mb-4 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <Link
            key={tab.value}
            href={href({ status: tab.value })}
            aria-current={status === tab.value ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              status === tab.value ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:border-line-2 hover:text-ink",
            )}
          >
            {tab.label}
            <span className="font-mono text-[11.5px] tabular-nums text-muted">{tab.count}</span>
          </Link>
        ))}
      </nav>

      <form className="mb-6 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-end">
        <input type="hidden" name="status" value={status} />
        <Field label={pick(locale, "Ученик", "Learner")} htmlFor="hw-q">
          <Input id="hw-q" name="q" defaultValue={filters.q ?? ""} placeholder={pick(locale, "Email или имя", "Email or name")} />
        </Field>
        <Field label={pick(locale, "Тариф", "Plan")} htmlFor="hw-plan">
          <Select id="hw-plan" name="plan" defaultValue={plan}>
            <option value="all">{pick(locale, "Все", "All")}</option>
            <option value="mentor">{pick(locale, "С ментором", "Mentor plan")}</option>
            <option value="self">{pick(locale, "Самостоятельно", "Self-study")}</option>
            <option value="other">{pick(locale, "Подписка или выдан вручную", "Subscription or granted")}</option>
          </Select>
        </Field>
        <Field label={pick(locale, "Курс", "Course")} htmlFor="hw-course">
          <Select id="hw-course" name="course" defaultValue={course}>
            <option value="">{pick(locale, "Все курсы", "All courses")}</option>
            {courses.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button type="submit">{pick(locale, "Показать", "Show")}</Button>
          <Link href={path("/studio/homework", locale)} className="self-center text-[12.5px] text-muted hover:text-ink">
            {pick(locale, "Сбросить", "Reset")}
          </Link>
        </div>
      </form>

      <HomeworkQueue
        locale={locale}
        d={d}
        items={items}
        onReview={handleReview}
        learnerBase={canOpen(dashboard.role, "learners") ? path("/studio/learners/", locale) : undefined}
        emptyTitle={status === "pending" ? undefined : pick(locale, "Ничего не нашлось", "Nothing found")}
        emptyBody={status === "pending" ? undefined : pick(locale, "Попробуйте другой фильтр.", "Try another filter.")}
      />
    </StudioPage>
  );
}
