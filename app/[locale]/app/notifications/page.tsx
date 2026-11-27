import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { MarkNotificationsRead } from "@/components/app/mark-notifications-read";
import { Dot } from "@/components/primitives/badge";
import { EmptyState } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { getNotifications } from "@/lib/api/session";
import { formatRelative, getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

/** Every notification, newest first; opening the page marks them read. */
export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const notifications = await getNotifications();
  const unread = notifications.some((notification) => !notification.read);

  return (
    <AppPage
      eyebrow={d.nav.notifications}
      title={pick(locale, "Уведомления", "Notifications")}
      body={pick(
        locale,
        "Принятые задания, новые уроки, покупки и ответы поддержки.",
        "Accepted assignments, new lessons, purchases and support replies.",
      )}
    >
      {unread && <MarkNotificationsRead />}
      {notifications.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {notifications.map((notification) => {
            const body = (
              <>
                <span className="mt-1.5 w-2 shrink-0">{!notification.read && <Dot />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] leading-snug text-ink">{notification.title}</span>
                  <span className="mt-1 block text-[12.5px] text-muted">{formatRelative(notification.createdAt, locale)}</span>
                </span>
              </>
            );
            return (
              <li key={notification.id}>
                {notification.href ? (
                  <Link href={path(notification.href, locale)} className="flex gap-3 p-4 transition-colors hover:bg-surface-2">
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3 p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<BellRing className="h-5 w-5" aria-hidden />}
          title={pick(locale, "Пока тихо", "Nothing yet")}
          body={pick(
            locale,
            "Здесь появятся принятые задания, новые уроки и ответы поддержки.",
            "Accepted assignments, new lessons and support replies will appear here.",
          )}
        />
      )}
    </AppPage>
  );
}
