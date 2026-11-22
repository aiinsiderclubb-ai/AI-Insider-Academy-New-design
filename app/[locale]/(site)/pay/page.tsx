import type { Metadata } from "next";
import { Container } from "@/components/primitives/surface";
import { pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n";
import { PaddlePayLink } from "./paddle-pay-link";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

/**
 * Paddle's default payment link. A transaction's checkout URL points here with
 * `?_ptxn=txn_…`; Paddle.js reads it and opens the checkout itself.
 */
export default async function PayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  return (
    <Container size="narrow" className="pt-16 pb-24 text-center">
      <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] tracking-[-0.03em]">
        {pick(locale, "Оплата заказа", "Payment")}
      </h1>
      <PaddlePayLink locale={locale} />
    </Container>
  );
}
