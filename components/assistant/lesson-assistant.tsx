"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { AssistantThread } from "./assistant-thread";
import { useAssistant } from "./use-assistant";

/**
 * The assistant as a tutor for one lesson. The API looks the lesson up by id
 * and briefs the model on it; each lesson keeps its own conversation.
 */
export function LessonAssistant({
  d,
  locale,
  courseId,
  lessonId,
}: {
  d: Dictionary;
  locale: Locale;
  courseId: string;
  lessonId: string;
}) {
  const pathname = usePathname();
  const lesson = React.useMemo(() => ({ courseId, lessonId }), [courseId, lessonId]);
  const chat = useAssistant({
    locale,
    storageKey: `insider-assistant:lesson:${courseId}:${lessonId}`,
    page: pathname,
    lesson,
  });

  return <AssistantThread chat={chat} d={d} locale={locale} mode="lesson" />;
}
