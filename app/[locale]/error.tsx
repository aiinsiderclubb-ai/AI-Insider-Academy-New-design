"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { getDictionary, defaultLocale } from "@/lib/i18n";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const d = getDictionary(defaultLocale);

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <Container size="narrow" className="flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="mt-7 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-[-0.035em]">{d.states.errorTitle}</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">{d.states.errorBody}</p>
      {error.digest && <p className="mt-3 font-mono text-[12px] text-faint">#{error.digest}</p>}
      <Button onClick={reset} size="lg" className="mt-8">
        {d.common.retry}
      </Button>
    </Container>
  );
}
