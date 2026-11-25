import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { DeleteLearnerButton, GrantForm, RevokeGrantButton, TemporaryPasswordForm } from "@/components/studio/people-controls";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { pick } from "@/content/locale";
import { canOpen, getStudioDashboard, getUserCard, studioItemOptions } from "@/lib/api/studio";
import { deleteLearner, grantItem, revokeGrant, setTemporaryPassword } from "@/lib/api/studio-actions";
import { formatDate, formatNumber, formatPrice, formatRelative, getDictionary, path, type Locale } from "@/lib/i18n";

export default async function StudioLearnerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const title = pick(locale, "Ученик", "Learner");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "learners")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const card = await getUserCard(id);
  if (!card) notFound();
  const isAdmin = dashboard.role === "admin";
  const items = isAdmin ? await studioItemOptions(locale) : [];
  const userId = card.user.id;
  const activeGrants = card.entitlements.filter((item) => item.status === "active");
  const paid = card.payments.filter((payment) => payment.status === "completed").reduce((sum, payment) => sum + payment.amount, 0);
  const date = (value: string | null | undefined) => (value ? formatDate(value, locale, { day: "numeric", month: "short", year: "2-digit" }) : "—");

  async function handleGrant(itemId: string, licenseTier: string) {
    "use server";
    return grantItem(locale, userId, itemId, licenseTier);
  }
  async function handleRevokePurchase(purchaseId: number) {
    "use server";
    return revokeGrant(locale, userId, { purchaseId });
  }
  async function handleRevokeEntitlement(entitlementId: string) {
    "use server";
    return revokeGrant(locale, userId, { entitlementId });
  }
  async function handleDelete() {
    "use server";
    return deleteLearner(locale, userId);
  }
  async function handleTemporaryPassword(password?: string) {
    "use server";
    return setTemporaryPassword(locale, userId, password);
  }
  const METHOD: Record<string, string> = {
    password: pick(locale, "пароль", "password"),
    google: "Google",
    apple: "Apple",
    email_code: pick(locale, "код из письма", "email code"),
    email_link: pick(locale, "ссылка из письма", "email link"),
    test: pick(locale, "тестовый вход", "test login"),
  };
  const logins = card.logins ?? [];

  return (
    <StudioPage
      title={card.user.name || card.user.email}
      body={
        <span className="font-mono text-[13px]">
          ID {card.user.id} · {card.user.email} · {card.user.personalId ?? "—"} · {pick(locale, "с нами с", "joined")} {date(card.user.createdAt)}
          {card.lastLoginAt ? ` · ${pick(locale, "вход", "signed in")} ${formatRelative(card.lastLoginAt, locale)}` : ""}
          {card.user.authProvider ? ` · ${card.user.authProvider}` : ""}
        </span>
      }
      action={
        <Link href={path("/studio/learners", locale)} className="text-[13px] text-accent-ink underline-offset-4 hover:underline">
          ← {pick(locale, "Все ученики", "All learners")}
        </Link>
      }
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Оплачено", "Paid")} value={formatPrice(paid, locale)} hint={`${card.payments.length} ${pick(locale, "оплат", "payments")}`} />
        <StatTile label={pick(locale, "Курсов открыто", "Courses open")} value={formatNumber(card.purchases.length, locale)} />
        <StatTile label={pick(locale, "Товаров в Библиотеке", "Library items")} value={formatNumber(activeGrants.length, locale)} />
        <StatTile
          label={pick(locale, "Пригласил", "Invited")}
          value={formatNumber(card.referral.invited.length, locale)}
          hint={`${card.referral.invited.filter((item) => item.converted).length} ${pick(locale, "купили", "bought")}`}
        />
      </section>

      {isAdmin && (
        <Panel title={pick(locale, "Выдать доступ", "Grant access")} className="mb-6">
          <GrantForm locale={locale} d={d} items={items} onGrant={handleGrant} />
          <p className="mt-3 text-[12.5px] text-muted">
            {pick(
              locale,
              "Пакет открывает свои курсы и бонусы, хранилище — свои товары. Выдача пишется в журнал действий.",
              "A pack opens its courses and bonuses, a vault its products. Every grant goes to the audit log.",
            )}
          </p>
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={pick(locale, "Курсы", "Courses")}>
          <DataTable
            caption={pick(locale, "Курсы", "Courses")}
            columns={[
              { key: "title", label: pick(locale, "Курс", "Course") },
              { key: "source", label: pick(locale, "Откуда", "Source") },
              { key: "date", label: pick(locale, "Дата", "Date"), align: "right" },
              { key: "actions", label: "", align: "right" },
            ]}
            empty={pick(locale, "Курсов нет", "No courses")}
          >
            {card.purchases.map((purchase) => (
              <Row key={purchase.id}>
                <Cell strong>
                  {purchase.title}
                  {purchase.plan === "mentor" && <Badge tone="accent" className="ml-1.5">{pick(locale, "с ментором", "mentor")}</Badge>}
                  {purchase.plan === "self" && <Badge tone="outline" className="ml-1.5">{pick(locale, "самостоятельно", "self-study")}</Badge>}
                </Cell>
                <Cell>
                  <Badge tone="outline">{purchase.provider ?? "—"}</Badge>
                </Cell>
                <Cell align="right" mono>
                  {date(purchase.purchasedAt)}
                </Cell>
                <Cell align="right">
                  {isAdmin && (
                    <RevokeGrantButton locale={locale} d={d} label={purchase.title} onRevoke={handleRevokePurchase.bind(null, purchase.id)} />
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>

        <Panel title={pick(locale, "Товары и хранилища", "Products and vaults")}>
          <DataTable
            caption={pick(locale, "Товары", "Products")}
            columns={[
              { key: "title", label: pick(locale, "Товар", "Product") },
              { key: "source", label: pick(locale, "Откуда", "Source") },
              { key: "status", label: pick(locale, "Статус", "Status") },
              { key: "actions", label: "", align: "right" },
            ]}
            empty={pick(locale, "Товаров нет", "No products")}
          >
            {card.entitlements.map((grant) => (
              <Row key={grant.id}>
                <Cell strong>
                  {grant.title}
                  <span className="ml-1.5 font-mono text-[11px] text-muted">{grant.licenseTier}</span>
                </Cell>
                <Cell>
                  <Badge tone="outline">{grant.sourceType}</Badge>
                </Cell>
                <Cell>
                  <Badge tone={grant.status === "active" ? "success" : "neutral"}>
                    {grant.status === "active" ? pick(locale, "активен", "active") : pick(locale, "забран", "revoked")}
                  </Badge>
                </Cell>
                <Cell align="right">
                  {isAdmin && grant.status === "active" && (
                    <RevokeGrantButton locale={locale} d={d} label={grant.title} onRevoke={handleRevokeEntitlement.bind(null, grant.id)} />
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>

        <Panel title={pick(locale, "Оплаты", "Payments")}>
          <DataTable
            caption={pick(locale, "Оплаты", "Payments")}
            columns={[
              { key: "item", label: pick(locale, "Позиция", "Item") },
              { key: "via", label: pick(locale, "Через", "Via") },
              { key: "status", label: pick(locale, "Статус", "Status") },
              { key: "amount", label: pick(locale, "Сумма", "Amount"), align: "right" },
            ]}
            empty={pick(locale, "Оплат нет", "No payments")}
          >
            {card.payments.map((payment) => (
              <Row key={payment.id}>
                <Cell strong>{payment.itemTitle}</Cell>
                <Cell>
                  <Badge tone="outline">{payment.provider}</Badge>
                </Cell>
                <Cell>
                  <Badge tone={payment.status === "completed" ? "success" : payment.status === "refunded" ? "warning" : "neutral"}>{payment.status}</Badge>
                </Cell>
                <Cell align="right" mono>
                  {formatPrice(payment.amount, locale)}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>

        <Panel title={pick(locale, "Рефералы и коды", "Referrals and codes")}>
          <dl className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">{pick(locale, "Пришёл по ссылке", "Came by the link of")}</dt>
              <dd className="font-mono text-ink-2">
                {card.referral.invitedBy
                  ? `${card.referral.invitedBy.email}${card.referral.invitedBy.converted ? ` · ${pick(locale, "купил", "bought")}` : ""}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">{pick(locale, "Пригласил", "Invited")}</dt>
              <dd className="text-right font-mono text-ink-2">
                {card.referral.invited.length
                  ? card.referral.invited.map((item) => `${item.email}${item.converted ? " ✓" : ""}`).join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">{pick(locale, "Сообщений в поддержку", "Support messages")}</dt>
              <dd className="font-mono text-ink-2">{card.supportMessages}</dd>
            </div>
          </dl>
          {card.rewards.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
              {card.rewards.map((code) => (
                <li key={code.code} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="font-mono text-ink">{code.code}</span>
                  <span className="flex items-center gap-2 text-muted">
                    −{code.percent}%
                    <Badge tone={code.status === "active" ? "success" : "neutral"}>{code.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title={pick(locale, "Входы в аккаунт", "Sign-ins")}>
          <DataTable
            caption={pick(locale, "Входы", "Sign-ins")}
            columns={[
              { key: "when", label: pick(locale, "Когда", "When") },
              { key: "how", label: pick(locale, "Как", "How") },
              { key: "where", label: pick(locale, "Откуда", "From") },
            ]}
            empty={pick(locale, "Входов пока не записано", "No sign-ins recorded yet")}
          >
            {logins.map((login) => (
              <Row key={login.id}>
                <Cell mono>{formatDate(login.at, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Cell>
                <Cell>
                  <Badge tone="outline">{METHOD[login.method] ?? login.method}</Badge>
                </Cell>
                <Cell mono>
                  <span title={login.userAgent ?? ""}>{login.ip ?? "—"}</span>
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>

        {isAdmin && (
          <Panel title={pick(locale, "Пароль", "Password")}>
            <TemporaryPasswordForm
              locale={locale}
              d={d}
              email={card.user.email}
              active={card.passwordTemporary}
              onSet={handleTemporaryPassword}
            />
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              {pick(
                locale,
                "Человек входит с временным паролем по своему email, и кабинет сразу просит придумать свой. Почта аккаунта при этом считается подтверждённой.",
                "The person signs in with the temporary password and their email, and the cabinet asks them to choose their own right away. The account's email counts as confirmed.",
              )}
            </p>
          </Panel>
        )}
      </div>

      {isAdmin && (
        <div className="mt-8 flex justify-end border-t border-line pt-6">
          <DeleteLearnerButton locale={locale} d={d} email={card.user.email} backHref={path("/studio/learners", locale)} onDelete={handleDelete} />
        </div>
      )}
    </StudioPage>
  );
}
