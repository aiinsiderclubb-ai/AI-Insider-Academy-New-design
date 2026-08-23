"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  Keyboard,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  NotebookPen,
  Paperclip,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button, ButtonLink } from "@/components/primitives/button";
import { Field, Textarea } from "@/components/primitives/field";
import { Modal } from "@/components/primitives/overlay";
import { Progress } from "@/components/primitives/display";
import { EmptyState, Note } from "@/components/primitives/states";
import { useToast } from "@/components/primitives/toast";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";
import { cn, timecode } from "@/lib/utils";

export interface StudyLesson {
  index: number;
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl: string | null;
  unlocked: boolean;
}

export interface StudyHomework {
  task: string;
  deliverable: string;
  criteria: string;
}

export interface StudyNote {
  id: string;
  seconds: number;
  text: string;
  createdAt: string;
}

type Panel = "notes" | "assistant" | "resources" | null;
type Tab = "lesson" | "homework" | "discussion";

const NOTES_KEY = (courseId: string) => `aia-notes:${courseId}`;

export function StudyRoom({
  locale,
  d,
  course,
  lessons,
  current,
  homework,
  watched,
  canSubmitHomework,
}: {
  locale: Locale;
  d: Dictionary;
  course: { id: string; slug: string; title: string; lessonCount: number };
  lessons: StudyLesson[];
  current: StudyLesson;
  homework: StudyHomework | null;
  watched: number[];
  canSubmitHomework: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [done, setDone] = React.useState<number[]>(watched);
  const [panel, setPanel] = React.useState<Panel>(null);
  const [tab, setTab] = React.useState<Tab>("lesson");
  const [focus, setFocus] = React.useState(false);
  const [railOpen, setRailOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const isDone = done.includes(current.index);
  const percent = Math.round((new Set(done).size / Math.max(1, course.lessonCount)) * 100);

  const prev = lessons[current.index - 1];
  const next = lessons[current.index + 1];

  const go = React.useCallback(
    (lesson: StudyLesson | undefined) => {
      if (!lesson) return;
      router.push(path(`/study/${course.slug}/${lesson.index + 1}`, locale));
    },
    [course.slug, locale, router],
  );

  /* --------------------------------- notes -------------------------------- */

  const [notes, setNotes] = React.useState<StudyNote[]>([]);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTES_KEY(course.id));
      if (stored) setNotes(JSON.parse(stored) as StudyNote[]);
    } catch {
      /* notes are a convenience, never a blocker */
    }
  }, [course.id]);

  const persistNotes = (value: StudyNote[]) => {
    setNotes(value);
    try {
      localStorage.setItem(NOTES_KEY(course.id), JSON.stringify(value));
    } catch {
      /* storage full or blocked — keep the in-memory copy */
    }
  };

  const addNote = () => {
    if (!draft.trim()) return;
    persistNotes([
      { id: `n-${Date.now()}`, seconds: current.index * 0, text: draft.trim(), createdAt: new Date().toISOString() },
      ...notes,
    ]);
    setDraft("");
    push({ tone: "success", title: d.common.saved });
  };

  /* ------------------------------- progress -------------------------------- */

  async function toggleDone() {
    const nextDone = isDone ? done.filter((index) => index !== current.index) : [...done, current.index];
    setDone(nextDone);
    setSaving(true);
    try {
      const response = await fetch(`/api/me/progress/${encodeURIComponent(course.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { watched: nextDone } }),
      });
      if (!response.ok) throw new Error("failed");
      if (!isDone && next) push({ tone: "success", title: d.study.done, body: next.title });
    } catch {
      setDone(done);
      push({ tone: "warning", title: d.errors.generic });
    } finally {
      setSaving(false);
      router.refresh();
    }
  }

  /* ------------------------------- shortcuts ------------------------------- */

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key.toLowerCase()) {
        case "arrowright":
        case "j":
          event.preventDefault();
          go(next);
          break;
        case "arrowleft":
        case "k":
          event.preventDefault();
          go(prev);
          break;
        case "f":
          event.preventDefault();
          setFocus((value) => !value);
          break;
        case "n":
          event.preventDefault();
          setPanel("notes");
          break;
        case "a":
          event.preventDefault();
          setPanel("assistant");
          break;
        case "?":
          event.preventDefault();
          setShortcutsOpen(true);
          break;
        case "escape":
          setFocus(false);
          setPanel(null);
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, next, prev]);

  const filteredLessons = query
    ? lessons.filter((lesson) => `${lesson.title} ${lesson.description}`.toLowerCase().includes(query.toLowerCase()))
    : lessons;

  /* --------------------------------- render -------------------------------- */

  const rail = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={d.study.searchInCourse}
            aria-label={d.study.searchInCourse}
            className="h-9 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </label>
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredLessons.map((lesson) => {
          const active = lesson.index === current.index;
          const complete = done.includes(lesson.index);
          return (
            <li key={lesson.id}>
              <Link
                href={path(`/study/${course.slug}/${lesson.index + 1}`, locale)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex gap-3 rounded-md p-2.5 transition-colors",
                  active ? "bg-accent-soft" : "hover:bg-surface-3",
                  !lesson.unlocked && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] tabular-nums",
                    complete
                      ? "border-success bg-success text-white"
                      : active
                        ? "border-accent text-accent-ink"
                        : "border-line-2 text-faint",
                  )}
                >
                  {complete ? <Check className="h-3 w-3" aria-hidden /> : lesson.index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px] leading-snug", active ? "font-medium text-ink" : "text-ink-2")}>
                    {lesson.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-faint">
                    {!lesson.unlocked && <Lock className="h-3 w-3" aria-hidden />}
                    {lesson.duration}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-ground">
      {/* --------------------------------- bar --------------------------------- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
        <ButtonLink href={path(`/learn/${course.slug}`, locale)} variant="ghost" size="sm" className="shrink-0">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{d.common.back}</span>
        </ButtonLink>

        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-surface-3 lg:hidden"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          {current.index + 1}/{course.lessonCount}
        </button>

        <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
          <span className="truncate text-[13.5px] font-medium text-ink">{course.title}</span>
          <span className="h-4 w-px bg-line-2" aria-hidden />
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted">
            {current.index + 1}/{course.lessonCount}
          </span>
          <div className="max-w-56 flex-1">
            <Progress value={percent} size="sm" />
          </div>
        </div>

        <div className="flex flex-1 justify-end gap-1 lg:flex-none">
          <button
            type="button"
            onClick={() => setPanel(panel === "notes" ? null : "notes")}
            aria-pressed={panel === "notes"}
            aria-label={d.study.notes}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              panel === "notes" ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-3 hover:text-ink",
            )}
          >
            <NotebookPen className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "assistant" ? null : "assistant")}
            aria-pressed={panel === "assistant"}
            aria-label={d.study.assistant}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              panel === "assistant" ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:bg-surface-3 hover:text-ink",
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setFocus((value) => !value)}
            aria-pressed={focus}
            aria-label={d.study.focusMode}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {focus ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            aria-label={d.study.shortcuts}
            className="hidden h-9 w-9 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink sm:flex"
          >
            <Keyboard className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {/* -------------------------------- body --------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {!focus && (
          <aside className="hidden w-72 shrink-0 border-r border-line bg-surface-2 lg:block">{rail}</aside>
        )}

        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full px-4 py-6 sm:px-8 sm:py-9", focus ? "max-w-3xl" : "max-w-4xl")}>
            {/* ------------------------------ player ------------------------------ */}
            {current.unlocked ? (
              current.videoUrl ? (
                <div className="overflow-hidden rounded-xl border border-line bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    key={current.videoUrl}
                    src={current.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full"
                  />
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line-2 bg-surface-2 px-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-accent">
                    <Play className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="max-w-md">
                    <p className="font-display text-lg font-extrabold tracking-tight">{d.study.videoSoon}</p>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{d.study.videoSoonBody}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => push({ tone: "success", title: d.study.notifyMe })}>
                    {d.study.notifyMe}
                  </Button>
                </div>
              )
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-xl border border-line bg-surface-2 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink-3">
                  <Lock className="h-5 w-5" aria-hidden />
                </span>
                <div className="max-w-md">
                  <p className="font-display text-lg font-extrabold tracking-tight">{d.study.locked}</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{d.study.lockedBody}</p>
                </div>
                <ButtonLink href={path(`/learn/${course.slug}/buy`, locale)} size="sm">
                  {d.learn.buyCourse}
                </ButtonLink>
              </div>
            )}

            {/* ------------------------------- title ------------------------------ */}
            <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow">
                  {d.study.currentLesson} · {current.duration}
                </p>
                <h1 className="mt-3 text-[clamp(1.4rem,3vw,2rem)] leading-[1.1]">{current.title}</h1>
              </div>
              <Button
                variant={isDone ? "subtle" : "secondary"}
                size="sm"
                onClick={toggleDone}
                loading={saving}
                disabled={!current.unlocked}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
                {isDone ? d.study.done : d.study.markDone}
              </Button>
            </div>

            {/* -------------------------------- tabs ------------------------------ */}
            <div className="mt-7 border-b border-line">
              <div role="tablist" aria-label={d.study.space} className="flex gap-1">
                {(
                  [
                    ["lesson", d.study.aboutLesson],
                    ["homework", d.learn.homework],
                    ["discussion", d.study.discussion],
                  ] as [Tab, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    role="tab"
                    type="button"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={cn(
                      "-mb-px border-b-2 px-3.5 pb-3 text-[14px] font-medium transition-colors",
                      tab === value ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink-2",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="py-7">
              {tab === "lesson" && (
                <div className="prose-body text-[15px]">
                  <p>{current.description || d.study.videoSoonBody}</p>
                </div>
              )}

              {tab === "homework" &&
                (homework ? (
                  <div className="flex flex-col gap-4">
                    {[
                      { label: d.study.homeworkTask, value: homework.task },
                      { label: d.study.homeworkResult, value: homework.deliverable },
                      { label: d.study.homeworkCriteria, value: homework.criteria },
                    ].map((block) => (
                      <div key={block.label} className="rounded-lg border border-line bg-surface p-5">
                        <p className="eyebrow">{block.label}</p>
                        <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">{block.value}</p>
                      </div>
                    ))}

                    {canSubmitHomework ? (
                      <HomeworkForm course={course} lesson={current} d={d} />
                    ) : (
                      <Note tone="warning">{d.study.lockedBody}</Note>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    compact
                    title={d.learn.homework}
                    body={d.study.videoSoonBody}
                  />
                ))}

              {tab === "discussion" && (
                <EmptyState
                  compact
                  icon={<MessageSquare className="h-5 w-5" aria-hidden />}
                  title={d.study.discussion}
                  body={d.community.forumBody}
                  action={
                    <ButtonLink href={path("/community/forum", locale)} size="sm">
                      {d.community.askQuestion}
                    </ButtonLink>
                  }
                />
              )}
            </div>

            {/* ------------------------------- footer ----------------------------- */}
            <nav className="flex items-center justify-between gap-3 border-t border-line pt-6" aria-label={d.study.space}>
              <Button variant="ghost" size="sm" onClick={() => go(prev)} disabled={!prev}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
                {d.study.prevLesson}
              </Button>
              {next ? (
                <Button size="sm" onClick={() => go(next)} className="group">
                  {d.study.nextLesson}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </Button>
              ) : (
                <ButtonLink href={path("/app/achievements", locale)} size="sm">
                  {d.learn.certificate}
                </ButtonLink>
              )}
            </nav>
          </div>
        </main>

        {/* ------------------------------- panel -------------------------------- */}
        {panel && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-line bg-surface-2 xl:flex">
            <div className="flex h-12 items-center justify-between border-b border-line px-4">
              <p className="text-[13.5px] font-semibold text-ink">
                {panel === "notes" ? d.study.notes : panel === "assistant" ? d.study.assistant : d.study.resources}
              </p>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label={d.common.close}
                className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {panel === "notes" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      placeholder={d.study.addNote}
                      aria-label={d.study.addNote}
                    />
                    <Button size="sm" className="mt-2" onClick={addNote} disabled={!draft.trim()} full>
                      {d.study.addNote}
                    </Button>
                  </div>

                  {notes.length ? (
                    <ul className="flex flex-col gap-2">
                      {notes.map((note) => (
                        <li key={note.id} className="rounded-md border border-line bg-surface p-3">
                          <p className="font-mono text-[11px] text-faint">{timecode(note.seconds)}</p>
                          <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{note.text}</p>
                          <button
                            type="button"
                            onClick={() => persistNotes(notes.filter((item) => item.id !== note.id))}
                            className="mt-2 text-[12px] text-faint underline-offset-4 hover:text-danger hover:underline"
                          >
                            {d.common.remove}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] leading-relaxed text-muted">{d.study.notesEmpty}</p>
                  )}
                </div>
              )}

              {panel === "assistant" && <Assistant d={d} lessonTitle={current.title} courseTitle={course.title} />}
            </div>
          </aside>
        )}
      </div>

      {/* ---------------------------- mobile lesson rail ---------------------- */}
      {railOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={d.common.close}
            onClick={() => setRailOpen(false)}
            className="animate-fade absolute inset-0 bg-[rgb(23_19_15/0.45)] backdrop-blur-[2px]"
          />
          <div className="animate-pop absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-line bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <p className="truncate text-[14px] font-semibold text-ink">{course.title}</p>
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                aria-label={d.common.close}
                className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {rail}
          </div>
        </div>
      )}

      {/* ------------------------------- shortcuts ---------------------------- */}
      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title={d.study.shortcuts} size="sm">
        <dl className="flex flex-col gap-2.5">
          {[
            ["→ / J", d.study.nextLesson],
            ["← / K", d.study.prevLesson],
            ["F", d.study.focusMode],
            ["N", d.study.notes],
            ["A", d.study.assistant],
            ["Esc", d.common.close],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <dt className="text-[13.5px] text-ink-2">{label}</dt>
              <dd>
                <kbd className="rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink-3">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}

/* ============================== homework form ============================== */

function HomeworkForm({
  course,
  lesson,
  d,
}: {
  course: { id: string; title: string };
  lesson: StudyLesson;
  d: Dictionary;
}) {
  const { push } = useToast();
  const [content, setContent] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    const body = new FormData();
    body.set("courseId", course.id);
    body.set("courseTitle", course.title);
    body.set("lessonIndex", String(lesson.index));
    body.set("lessonTitle", lesson.title);
    body.set("content", content);
    if (file) body.set("file", file);

    try {
      const response = await fetch("/api/me/homework", { method: "POST", body });
      if (!response.ok) throw new Error("failed");
      setSent(true);
      push({ tone: "success", title: d.study.homeworkPending });
    } catch {
      push({ tone: "warning", title: d.errors.generic });
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-success/35 bg-success-soft p-5">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-success">
          <Check className="h-4 w-4" aria-hidden />
          {d.study.homeworkPending}
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{d.study.homeworkCriteria}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface p-5">
      <Field label={d.study.submitHomework} htmlFor="hw-content">
        <Textarea
          id="hw-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={5}
          placeholder={d.study.homeworkResult}
          required
        />
      </Field>

      <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-ink-3 transition-colors hover:border-line-3 hover:bg-surface-2">
        <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{file ? file.name : d.common.download}</span>
        <input
          type="file"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <Button type="submit" className="mt-4" loading={sending} disabled={!content.trim()} full>
        {d.study.submitHomework}
      </Button>
    </form>
  );
}

/* ================================ assistant ================================ */

function Assistant({ d, lessonTitle, courseTitle }: { d: Dictionary; lessonTitle: string; courseTitle: string }) {
  const [messages, setMessages] = React.useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;

    const history = [...messages, { role: "user" as const, content: question }];
    setMessages(history);
    setInput("");
    setThinking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Ты — наставник курса «${courseTitle}». Отвечай коротко и по делу. Текущий урок: «${lessonTitle}».`,
            },
            ...history,
          ],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { content?: string; reply?: string; error?: string };
      const reply = payload.content ?? payload.reply;
      setMessages([...history, { role: "assistant", content: reply || d.errors.generic }]);
    } catch {
      setMessages([...history, { role: "assistant", content: d.errors.network }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-[12.5px] leading-relaxed text-muted">
            {d.study.assistant} · {lessonTitle}
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "rounded-lg px-3 py-2.5 text-[13px] leading-relaxed",
              message.role === "user" ? "bg-accent-soft text-ink" : "border border-line bg-surface text-ink-2",
            )}
          >
            {message.content}
          </div>
        ))}
        {thinking && <div className="skeleton h-16 rounded-lg" />}
      </div>

      <form onSubmit={send} className="shrink-0">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(event as unknown as React.FormEvent);
            }
          }}
          rows={2}
          placeholder={d.community.askQuestion}
          aria-label={d.community.askQuestion}
        />
        <Button type="submit" size="sm" className="mt-2" loading={thinking} disabled={!input.trim()} full>
          {d.community.askQuestion}
        </Button>
      </form>
    </div>
  );
}
