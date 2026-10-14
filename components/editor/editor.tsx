"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListFilter,
  ListOrdered,
  Minus,
  Paperclip,
  Quote,
  Smartphone,
  Strikethrough,
  Table,
  Underline,
} from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { IsinFilter } from "./isin-filter";
import { MobileUploadDialog } from "./mobile-upload-dialog";
import { ATTACHMENT_ACCEPT, ATTACHMENT_TYPES, attachmentExtension, FileAttachment } from "./file-attachment";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

async function uploadImage(entryId: string, file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Nur PNG, JPG, GIF oder WebP");
  if (file.size > 10 * 1024 * 1024) throw new Error("Bild ist größer als 10 MB");
  const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
  const path = `entries/${entryId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return `/media/${path}`;
}

/** Lädt eine Excel-/CSV-Datei hoch; der Originalname bleibt im Pfad für den Download erhalten. */
async function uploadAttachment(entryId: string, file: File) {
  const ext = attachmentExtension(file.name);
  if (!ext) throw new Error("Erlaubt sind Bilder sowie Excel- und CSV-Dateien (.xlsx, .xls, .xlsm, .csv)");
  if (file.size > 25 * 1024 * 1024) throw new Error("Datei ist größer als 25 MB");
  const base = file.name
    .slice(0, -(ext.length + 1))
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "datei";
  const path = `entries/${entryId}/${crypto.randomUUID()}-${base}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: ATTACHMENT_TYPES[ext] });
  if (error) throw error;
  return `/media/${path}`;
}

export function Editor({
  entryId,
  content,
  editable,
  onChange,
  onError,
}: {
  entryId: string;
  content: JSONContent;
  editable: boolean;
  onChange?: (json: JSONContent, text: string) => void;
  onError?: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const handlers = useRef({ onChange, onError });
  handlers.current = { onChange, onError };

  const insertFiles = async (editor: TiptapEditor, files: File[], pos?: number) => {
    for (const file of files) {
      try {
        const isImage = file.type.startsWith("image/");
        const node = isImage
          ? { type: "image", attrs: { src: await uploadImage(entryId, file), alt: file.name } }
          : {
              type: "fileAttachment",
              attrs: { src: await uploadAttachment(entryId, file), name: file.name, size: file.size },
            };
        const chain = editor.chain().focus();
        if (pos !== undefined) chain.insertContentAt(pos, node);
        else chain.insertContent(node);
        chain.run();
      } catch (err) {
        handlers.current.onError?.(err instanceof Error ? err.message : "Upload fehlgeschlagen");
      }
    }
  };

  const editorRef = useRef<TiptapEditor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: !editable, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ inline: false }),
      FileAttachment,
      IsinFilter,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "Schreib los … Bilder und Excel-Dateien einfach hineinziehen oder einfügen." }),
    ],
    editorProps: {
      attributes: { class: "prose-lynn", id: "entry-content" },
      handleDrop(view, event, _slice, moved) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || !files.length || !editorRef.current) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFiles(editorRef.current, files, pos);
        return true;
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length || !editorRef.current) return false;
        event.preventDefault();
        void insertFiles(editorRef.current, files);
        return true;
      },
    },
    onUpdate({ editor }) {
      // ProseMirror legt attrs als Objekte ohne Prototyp an; Server Actions verwerfen diese
      // beim Serialisieren (z. B. Bild-src). Daher in plain objects umwandeln.
      const json = JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent;
      handlers.current.onChange?.(json, editor.getText({ blockSeparator: "\n" }));
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  if (!editor) return <div className="prose-lynn min-h-[240px]" />;

  return (
    <div>
      {editable && (
        <Toolbar
          editor={editor}
          onImage={() => fileInput.current?.click()}
          onAttachment={() => attachmentInput.current?.click()}
          onMobile={() => setMobileOpen(true)}
        />
      )}
      {mobileOpen && (
        <MobileUploadDialog
          entryId={entryId}
          onClose={() => setMobileOpen(false)}
          onImage={(src) => editor.chain().focus().setImage({ src, alt: "Foto vom Handy" }).run()}
        />
      )}
      <EditorContent editor={editor} />
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void insertFiles(editor, files);
        }}
      />
      <input
        ref={attachmentInput}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void insertFiles(editor, files);
        }}
      />
    </div>
  );
}

function Toolbar({
  editor,
  onImage,
  onAttachment,
  onMobile,
}: {
  editor: TiptapEditor;
  onImage: () => void;
  onAttachment: () => void;
  onMobile: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
    }),
  });

  const btn = (label: string, active: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {icon}
    </button>
  );

  const sep = <span className="mx-1 h-5 w-px bg-border" />;
  const c = () => editor.chain().focus();

  return (
    <div className="sticky top-0 z-20 -mx-2 mb-6 flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-sidebar/95 px-1.5 py-1 backdrop-blur">
      {btn("Überschrift 1", state.h1, () => c().toggleHeading({ level: 1 }).run(), <Heading1 size={16} />)}
      {btn("Überschrift 2", state.h2, () => c().toggleHeading({ level: 2 }).run(), <Heading2 size={16} />)}
      {btn("Überschrift 3", state.h3, () => c().toggleHeading({ level: 3 }).run(), <Heading3 size={16} />)}
      {sep}
      {btn("Fett", state.bold, () => c().toggleBold().run(), <Bold size={15} />)}
      {btn("Kursiv", state.italic, () => c().toggleItalic().run(), <Italic size={15} />)}
      {btn("Unterstrichen", state.underline, () => c().toggleUnderline().run(), <Underline size={15} />)}
      {btn("Durchgestrichen", state.strike, () => c().toggleStrike().run(), <Strikethrough size={15} />)}
      {btn("Code", state.code, () => c().toggleCode().run(), <Code size={15} />)}
      {sep}
      {btn("Aufzählung", state.bullet, () => c().toggleBulletList().run(), <List size={16} />)}
      {btn("Nummerierte Liste", state.ordered, () => c().toggleOrderedList().run(), <ListOrdered size={16} />)}
      {btn("Zitat / Hinweis", state.quote, () => c().toggleBlockquote().run(), <Quote size={15} />)}
      {btn("Trennlinie", false, () => c().setHorizontalRule().run(), <Minus size={16} />)}
      {sep}
      {btn(
        "Link",
        state.link,
        () => {
          if (state.link) return c().unsetLink().run();
          const url = prompt("Link-Adresse");
          if (url) c().extendMarkRange("link").setLink({ href: url }).run();
        },
        <Link2 size={16} />,
      )}
      {btn(
        state.table ? "Tabelle entfernen" : "Tabelle einfügen",
        state.table,
        () => (state.table ? c().deleteTable().run() : c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()),
        <Table size={15} />,
      )}
      {btn("ISIN-Filter einfügen", false, () => c().insertIsinFilter().run(), <ListFilter size={16} />)}
      {btn("Bild hochladen", false, onImage, <ImagePlus size={16} />)}
      {btn("Foto mit Handy aufnehmen (QR-Code)", false, onMobile, <Smartphone size={15} />)}
      {btn("Excel-Datei anhängen", false, onAttachment, <Paperclip size={15} />)}
    </div>
  );
}
