"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "sm" && "h-8 px-2.5 text-[13px]",
        size === "icon" && "h-8 w-8",
        variant === "primary" && "bg-accent text-[#1f1e1d] hover:bg-accent-hover",
        variant === "secondary" && "border border-border bg-surface-2 text-text-2 hover:bg-surface-3 hover:text-text",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-text",
        variant === "danger" && "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        className,
      )}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none",
        props.className,
      )}
    />
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-muted">
      {children}
    </label>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
  sheet,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  /** Auf dem Handy als Bottom-Sheet (von unten), auf dem Desktop normaler Dialog. */
  sheet?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-32px)] rounded-2xl border border-border bg-sidebar p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[2px]",
        wide ? "max-w-2xl" : "max-w-md",
        sheet &&
          "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:animate-[sheet-up_200ms_ease-out]",
      )}
    >
      {open && (
        <div className="animate-fade-up">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
              <X size={16} />
            </Button>
          </div>
          <div className="max-h-[75dvh] overflow-y-auto px-5 py-5 max-sm:max-h-[82dvh]">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export type MenuItem =
  | { label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean }
  | "separator";

export function Menu({
  trigger,
  items,
  align = "left",
}: {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean }) => React.ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        },
        "aria-expanded": open,
      })}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-48 animate-fade-up rounded-xl border border-border bg-surface-2 p-1 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <div key={i} className="my-1 h-px bg-border" />
            ) : (
              <button
                key={i}
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  item.danger ? "text-danger hover:bg-danger/10" : "text-text-2 hover:bg-surface-3 hover:text-text",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 font-medium text-text-2"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {letters || "?"}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <div className="mb-3 text-faint">{icon}</div>
      <p className="font-medium text-text-2">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted">{children}</div>}
    </div>
  );
}
