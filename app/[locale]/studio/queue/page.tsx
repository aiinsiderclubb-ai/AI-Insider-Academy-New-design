import { StudioPage } from "@/components/studio/studio-shell";
import { QueueBoard } from "@/components/studio/queue-board";
import { pick } from "@/content/locale";
import { getStudioDashboard } from "@/lib/api/studio";
import { decideApplication, moderateReview, reviewHomework } from "@/lib/api/studio-actions";
import { getDictionary, type Locale } from "@/lib/i18n";

export default async function StudioQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale: raw } = await params;
  const { tab } = await searchParams;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;

  const homework = (dashboard.homework ?? []).filter((item) => item.status === "pending");
  const applications = (dashboard.applications ?? []).filter(
    (item) => item.status === "pending" || item.status === "new",
  );
  const reviews = (dashboard.reviews ?? []).filter((item) => (item.status ?? "pending") === "pending");

  async function handleHomework(id: string, status: "accepted" | "resubmit", comment?: string) {
    "use server";
    return reviewHomework(locale, id, status, comment);
  }

  async function handleApplication(id: string, decision: "approve" | "reject") {
    "use server";
    return decideApplication(locale, id, decision);
  }

  async function handleReview(id: string, status: "approved" | "rejected") {
    "use server";
    return moderateReview(locale, id, status);
  }

  return (
    <StudioPage
      title={pick(locale, "Очереди решений", "Decision queues")}
      body={pick(
        locale,
        "Всё, что ждёт вашего действия — в одном месте, без переходов по разделам.",
        "Everything waiting on you, in one place, with no section hopping.",
      )}
    >
      <QueueBoard
        locale={locale}
        d={d}
        initialTab={tab === "applications" || tab === "reviews" ? tab : "homework"}
        homework={homework}
        applications={applications}
        reviews={reviews}
        onReviewHomework={handleHomework}
        onDecideApplication={handleApplication}
        onModerateReview={handleReview}
      />
    </StudioPage>
  );
}
