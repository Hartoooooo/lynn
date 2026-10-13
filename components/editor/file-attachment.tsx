"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

/** Erlaubte Anhänge (neben Bildern): Excel und CSV. Endung → MIME-Typ. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
};

export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => `.${ext}`)
  .concat(Object.values(ATTACHMENT_TYPES))
  .join(",");

export function attachmentExtension(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext in ATTACHMENT_TYPES ? ext : null;
}

export function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attrs: { src: string; name: string; size: number }) => ReturnType;
    };
  }
}

/** Block-Knoten für Dateianhänge: Karte mit Name, Größe und Download-Button. */
export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: { default: "Datei" },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[data-file-attachment]",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("href"),
          name: (el as HTMLElement).getAttribute("data-name") ?? "Datei",
          size: Number((el as HTMLElement).getAttribute("data-size") ?? 0),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-file-attachment": "",
        href: node.attrs.src,
        "data-name": node.attrs.name,
        "data-size": node.attrs.size,
        download: node.attrs.name,
      }),
      node.attrs.name,
    ];
  },

  // Dateiname fließt in content_text ein und ist damit durchsuchbar.
  renderText({ node }) {
    return `Anhang: ${node.attrs.name}`;
  },

  addCommands() {
    return {
      setFileAttachment:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },
});

function FileAttachmentView({ node, selected }: ReactNodeViewProps) {
  const { src, name, size } = node.attrs as { src: string | null; name: string; size: number };
  const ext = name.split(".").pop()?.toUpperCase() ?? "";

  return (
    <NodeViewWrapper className="my-3" data-drag-handle>
      <div
        contentEditable={false}
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 transition-colors",
          selected ? "border-accent" : "border-border",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#1d6f42]/20 text-[#5fbf86]">
          <FileSpreadsheet size={20} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[14.5px] font-medium text-text">{name}</div>
          <div className="mt-0.5 text-[12px] text-faint">
            {[ext, formatBytes(size)].filter(Boolean).join(" · ")}
          </div>
        </div>
        {src && (
          <a
            href={`${src}?name=${encodeURIComponent(name)}`}
            download={name}
            onMouseDown={(e) => e.stopPropagation()}
            className="file-download flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] text-text-2 no-underline transition hover:bg-surface-3 hover:text-text"
          >
            <Download size={14} /> Herunterladen
          </a>
        )}
      </div>
    </NodeViewWrapper>
  );
}
