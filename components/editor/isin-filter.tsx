"use client";

import { useMemo, useState } from "react";
import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Check, ClipboardCopy, ListFilter, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type IsinItem = { isin: string; addedAt: string };

const ISIN_PATTERN = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/g;

/** Findet alle ISINs in beliebigem Text (z. B. aus Excel oder einer Mail kopiert). */
export function extractIsins(text: string) {
  return [...new Set(text.toUpperCase().match(ISIN_PATTERN) ?? [])];
}

/** XWATCH-Filter im Format: a.isincod in ( 'ISIN1', 'ISIN2') */
export function toXwatchFilter(isins: string[]) {
  return `a.isincod in (\n${isins.map((i) => `'${i}'`).join(",\n")})`;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    isinFilter: {
      insertIsinFilter: () => ReturnType;
    };
  }
}

/** Block mit einer gepflegten ISIN-Liste und Kopier-Button für den XWATCH-Filter. */
export const IsinFilter = Node.create({
  name: "isinFilter",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      items: {
        default: [] as IsinItem[],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-items") ?? "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ "data-items": JSON.stringify(attrs.items ?? []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "pre[data-isin-filter]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const isins = (node.attrs.items as IsinItem[]).map((i) => i.isin);
    return ["pre", mergeAttributes(HTMLAttributes, { "data-isin-filter": "" }), toXwatchFilter(isins)];
  },

  // ISINs fließen in content_text ein → über die Suche auffindbar.
  renderText({ node }) {
    return `ISIN-Filter: ${(node.attrs.items as IsinItem[]).map((i) => i.isin).join(" ")}`;
  },

  addCommands() {
    return {
      insertIsinFilter:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { items: [] } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(IsinFilterView);
  },
});

function IsinFilterView({ node, updateAttributes, editor, selected }: ReactNodeViewProps) {
  const rawItems = node.attrs.items as IsinItem[] | undefined;
  const items = useMemo(() => rawItems ?? [], [rawItems]);
  const editable = editor.isEditable;
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<"filter" | "list" | null>(null);

  const isins = useMemo(() => items.map((i) => i.isin), [items]);
  const filterText = toXwatchFilter(isins);
  const visible = query.trim()
    ? items.filter((i) => i.isin.includes(query.trim().toUpperCase()))
    : items;

  function add(text: string) {
    const found = extractIsins(text);
    if (!found.length) {
      setNotice("Keine ISIN erkannt (Format: 2 Buchstaben + 9 Zeichen + Prüfziffer).");
      return;
    }
    const existing = new Set(isins);
    const fresh = found.filter((i) => !existing.has(i));
    const now = new Date().toISOString();
    if (fresh.length) {
      updateAttributes({ items: [...items, ...fresh.map((isin) => ({ isin, addedAt: now }))] });
    }
    const dupes = found.length - fresh.length;
    setNotice(
      `${fresh.length} ${fresh.length === 1 ? "ISIN" : "ISINs"} hinzugefügt` +
        (dupes ? ` · ${dupes} bereits vorhanden` : ""),
    );
    setInput("");
  }

  function remove(isin: string) {
    updateAttributes({ items: items.filter((i) => i.isin !== isin) });
  }

  async function copy(kind: "filter" | "list") {
    await navigator.clipboard.writeText(kind === "filter" ? filterText : isins.join("\n"));
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  }

  return (
    <NodeViewWrapper className="my-5" data-drag-handle>
      <div
        contentEditable={false}
        className={cn(
          "not-prose rounded-2xl border bg-surface text-[14px] leading-normal transition-colors",
          selected ? "border-accent" : "border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <ListFilter size={16} className="text-accent" />
          <span className="font-medium text-text">ISIN-Filter</span>
          <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[12px] text-muted">{isins.length}</span>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              disabled={!isins.length}
              onClick={() => void copy("list")}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] text-text-2 transition hover:bg-surface-3 hover:text-text disabled:opacity-40"
            >
              {copied === "list" ? <Check size={14} className="text-success" /> : <ClipboardCopy size={14} />}
              Nur ISINs
            </button>
            <button
              type="button"
              disabled={!isins.length}
              onClick={() => void copy("filter")}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-[#1f1e1d] transition hover:bg-accent-hover disabled:opacity-40"
            >
              {copied === "filter" ? <Check size={14} /> : <ClipboardCopy size={14} />}
              {copied === "filter" ? "Kopiert" : "XWATCH-Filter kopieren"}
            </button>
          </div>
        </div>

        {editable && (
          <div className="border-b border-border px-4 py-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (extractIsins(text).length) {
                    e.preventDefault();
                    add(text);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    add(input);
                  }
                }}
                rows={1}
                placeholder="ISINs hier einfügen – beliebiger Text, Liste oder Excel-Spalte"
                className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-text outline-none placeholder:font-sans placeholder:text-faint focus:border-accent"
              />
              <button
                type="button"
                onClick={() => add(input)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] text-text-2 transition hover:bg-surface-3 hover:text-text"
              >
                <Plus size={14} /> Hinzufügen
              </button>
            </div>
            {notice && <p className="mt-2 text-[12.5px] text-muted">{notice}</p>}
          </div>
        )}

        {items.length > 0 && (
          <div className="px-4 py-3">
            {items.length > 8 && (
              <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5">
                <Search size={13} className="text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ISIN suchen …"
                  className="h-8 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-faint"
                />
              </div>
            )}
            <ul className="grid grid-cols-1 gap-1 [@media(min-width:1100px)]:grid-cols-2">
              {visible.map((item) => (
                <li
                  key={item.isin}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2"
                >
                  <span className="font-mono text-[13px] text-text">{item.isin}</span>
                  <span className="text-[11.5px] text-faint">
                    seit {new Date(item.addedAt).toLocaleDateString("de-DE")}
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => remove(item.isin)}
                      className="ml-auto rounded p-1 text-faint opacity-0 transition hover:text-danger group-hover:opacity-100"
                      aria-label={`${item.isin} entfernen`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
              Vorschau
              {editable && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Alle ${items.length} ISINs entfernen?`)) updateAttributes({ items: [] });
                  }}
                  className="flex items-center gap-1 normal-case tracking-normal text-faint hover:text-danger"
                >
                  <Trash2 size={12} /> Alle entfernen
                </button>
              )}
            </div>
            <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-[#191817] px-3 py-2 font-mono text-[12.5px] leading-relaxed text-text-2">
              {filterText}
            </pre>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
