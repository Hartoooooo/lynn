"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Heading = { level: number; text: string; el: HTMLElement };

/** Inhaltsverzeichnis, live aus den Überschriften des Editors gelesen. */
export function Toc() {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const read = () => {
      const root = document.getElementById("entry-content");
      if (!root) return false;
      const els = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3"));
      setHeadings(
        els
          .map((el) => ({ level: Number(el.tagName[1]), text: el.textContent?.trim() ?? "", el }))
          .filter((h) => h.text),
      );
      return root;
    };
    const attach = () => {
      const root = read();
      if (!root) return;
      observer = new MutationObserver(() => read());
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      clearInterval(wait);
    };
    const wait = setInterval(attach, 300);
    attach();
    return () => {
      clearInterval(wait);
      observer?.disconnect();
    };
  }, []);

  if (headings.length < 2) return null;

  return (
    <section>
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">Inhalt</h2>
      <ul className="space-y-0.5 border-l border-border">
        {headings.map((h, i) => (
          <li key={i}>
            <button
              onClick={() => h.el.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={cn(
                "-ml-px block w-full truncate border-l border-transparent py-1 text-left text-[13px] text-muted transition hover:border-accent hover:text-text",
                h.level === 1 && "pl-3",
                h.level === 2 && "pl-3",
                h.level === 3 && "pl-6",
              )}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
