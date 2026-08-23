"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Modal — native <dialog> so focus trapping, Esc and inertness come free.
   ========================================================================== */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-lg",
        "backdrop:bg-[rgb(23_19_15/0.45)] backdrop:backdrop-blur-[2px]",
        "open:animate-pop",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-2xl",
      )}
    >
      <div className="flex items-start justify-between gap-6 px-6 pt-5 pb-1">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="-mr-1.5 -mt-1 rounded-md p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <X className="h-4.5 w-4.5" aria-hidden />
        </button>
      </div>
      {children && <div className="px-6 py-4">{children}</div>}
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">{footer}</div>
      )}
    </dialog>
  );
}

/* ==========================================================================
   Drawer — same dialog element, docked to an edge. Bottom sheet on mobile.
   ========================================================================== */

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left" | "bottom";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "max-h-full max-w-full border border-line bg-surface p-0 text-ink shadow-lg",
        "backdrop:bg-[rgb(23_19_15/0.45)] backdrop:backdrop-blur-[2px]",
        side === "right" && "mr-0 ml-auto h-full w-[min(26rem,100%)] rounded-l-xl",
        side === "left" && "mr-auto ml-0 h-full w-[min(22rem,100%)] rounded-r-xl",
        side === "bottom" && "mt-auto mb-0 w-full max-w-none rounded-t-2xl",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-extrabold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1.5 rounded-md p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-surface-2 px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}

/* ==========================================================================
   Popover — anchored panel used for menus, filters and the language switcher.
   ========================================================================== */

export function Popover({
  trigger,
  children,
  align = "end",
  className,
  panelClassName,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen((value) => !value), ref: triggerRef })}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "animate-pop absolute top-[calc(100%+8px)] z-50 min-w-52 rounded-lg border border-line bg-surface p-1.5 shadow-pop",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors",
        active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
        className,
      )}
    />
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow px-2.5 pt-2 pb-1.5">{children}</p>;
}

export function MenuSeparator() {
  return <hr className="my-1.5 border-line" />;
}
