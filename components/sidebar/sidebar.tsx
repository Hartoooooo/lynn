"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  FolderTree,
  Home,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Pencil,
  Plus,
  Settings,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { deleteTopic, reorderTopics, setTopicArchived, updateTopic } from "@/app/actions";
import { Logo } from "@/components/logo";
import { TopicIcon } from "@/components/topic-icon";
import { Avatar, Menu } from "@/components/ui";
import type { UserRole } from "@/lib/database.types";
import { cn, ROLE_LABEL } from "@/lib/utils";
import { TopicDialog, type TopicDraft } from "./topic-dialog";

export type NavTopic = { id: string; name: string; slug: string; icon: string; color: string };

export function Sidebar({
  topics: initialTopics,
  user,
  collapsed,
  onToggleCollapsed,
}: {
  topics: NavTopic[];
  user: { name: string; email: string; role: UserRole };
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [topics, setTopics] = useState(initialTopics);
  const [dialog, setDialog] = useState<{ open: boolean; initial?: TopicDraft }>({ open: false });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const canEdit = user.role !== "viewer";
  const isAdmin = user.role === "admin";

  useEffect(() => setTopics(initialTopics), [initialTopics]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = topics.findIndex((t) => t.id === active.id);
    const newIndex = topics.findIndex((t) => t.id === over.id);
    const next = arrayMove(topics, oldIndex, newIndex);
    setTopics(next);
    startTransition(() => reorderTopics(next.map((t) => t.id)));
  }

  function rename(id: string, name: string) {
    setRenamingId(null);
    const trimmed = name.trim();
    const current = topics.find((t) => t.id === id);
    if (!trimmed || trimmed === current?.name) return;
    setTopics((ts) => ts.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
    startTransition(() => updateTopic(id, { name: trimmed }));
  }

  const navLink = (href: string, label: string, icon: React.ReactNode, badge?: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[14px] transition-colors",
          active ? "bg-surface-3 text-text" : "text-text-2 hover:bg-surface-2 hover:text-text",
          collapsed && "justify-center px-0",
        )}
      >
        {icon}
        {!collapsed && <span className="truncate">{label}</span>}
        {!collapsed && badge && (
          <span className="ml-auto shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-faint">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="flex h-dvh flex-col border-r border-border bg-sidebar">
      <div className={cn("flex h-14 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Lynn Startseite">
          <Logo size={26} />
          {!collapsed && <span className="font-serif text-[19px] font-semibold tracking-tight">Lynn</span>}
        </Link>
        {!collapsed && (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto rounded-lg p-1.5 text-faint transition hover:bg-surface-2 hover:text-text max-[900px]:hidden"
            aria-label="Seitenleiste einklappen"
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      <nav className="space-y-0.5 px-2.5 pt-1">
        {navLink("/", "Start", <Home size={17} />)}
        {navLink("/personal", "Personal", <Users size={17} />)}
        {navLink("/favoriten", "Favoriten", <Star size={17} />)}
        {navLink("/kategorien", "Kategorien", <FolderTree size={17} />, "EIX B")}
      </nav>

      <div className={cn("mt-6 flex items-center px-4 pb-1.5", collapsed && "justify-center px-0")}>
        {!collapsed ? (
          <>
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">Themen</span>
            {canEdit && (
              <button
                onClick={() => setDialog({ open: true })}
                className="ml-auto rounded-md p-1 text-faint transition hover:bg-surface-2 hover:text-text"
                aria-label="Neues Thema"
              >
                <Plus size={15} />
              </button>
            )}
          </>
        ) : (
          <div className="h-px w-6 bg-border" />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={topics.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5">
              {topics.map((topic) => (
                <SortableTopic
                  key={topic.id}
                  topic={topic}
                  active={pathname === `/t/${topic.slug}` || pathname.startsWith(`/t/${topic.slug}/`)}
                  collapsed={collapsed}
                  draggable={canEdit && !collapsed}
                  renaming={renamingId === topic.id}
                  onRename={(name) => rename(topic.id, name)}
                  onCancelRename={() => setRenamingId(null)}
                  menu={
                    canEdit && !collapsed ? (
                      <Menu
                        align="right"
                        trigger={(p) => (
                          <button
                            {...p}
                            className="rounded-md p-1 text-faint opacity-0 transition hover:bg-surface-3 hover:text-text group-hover:opacity-100 aria-expanded:opacity-100"
                            aria-label={`Optionen für ${topic.name}`}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        )}
                        items={[
                          { label: "Umbenennen", icon: <Pencil size={14} />, onSelect: () => setRenamingId(topic.id) },
                          {
                            label: "Symbol & Farbe",
                            icon: <Palette size={14} />,
                            onSelect: () => setDialog({ open: true, initial: topic }),
                          },
                          ...(isAdmin
                            ? ([
                                "separator",
                                {
                                  label: "Archivieren",
                                  icon: <Archive size={14} />,
                                  onSelect: () =>
                                    startTransition(async () => {
                                      await setTopicArchived(topic.id, true);
                                      if (pathname.startsWith(`/t/${topic.slug}`)) router.push("/");
                                    }),
                                },
                                {
                                  label: "Löschen",
                                  icon: <Trash2 size={14} />,
                                  danger: true,
                                  onSelect: () => {
                                    if (
                                      confirm(
                                        `„${topic.name}“ endgültig löschen? Alle Einträge darin werden ebenfalls gelöscht.`,
                                      )
                                    ) {
                                      startTransition(() => deleteTopic(topic.id));
                                    }
                                  },
                                },
                              ] as const)
                            : []),
                        ]}
                      />
                    ) : null
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {canEdit && !collapsed && (
          <button
            onClick={() => setDialog({ open: true })}
            className="mt-1 flex h-9 w-full items-center gap-3 rounded-[10px] px-2.5 text-[14px] text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <Plus size={16} />
            Thema hinzufügen
          </button>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border px-2.5 py-2.5">
        {collapsed && (
          <button
            onClick={onToggleCollapsed}
            className="flex h-9 w-full items-center justify-center rounded-[10px] text-text-2 hover:bg-surface-2 max-[900px]:hidden"
            aria-label="Seitenleiste ausklappen"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}
        {navLink("/einstellungen", "Einstellungen", <Settings size={17} />)}
        <div className={cn("flex items-center gap-2.5 rounded-[10px] px-2 py-1.5", collapsed && "justify-center px-0")}>
          <Avatar name={user.name} size={28} />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-medium text-text">{user.name}</div>
                <div className="truncate text-[11.5px] text-faint">{ROLE_LABEL[user.role]}</div>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  className="rounded-md p-1.5 text-faint transition hover:bg-surface-2 hover:text-text"
                  aria-label="Abmelden"
                  title="Abmelden"
                >
                  <LogOut size={15} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {dialog.open && (
        <TopicDialog
          key={dialog.initial?.id ?? "new"}
          open
          initial={dialog.initial}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </aside>
  );
}

function SortableTopic({
  topic,
  active,
  collapsed,
  draggable,
  renaming,
  onRename,
  onCancelRename,
  menu,
}: {
  topic: NavTopic;
  active: boolean;
  collapsed: boolean;
  draggable: boolean;
  renaming: boolean;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  menu: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
    disabled: !draggable,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-10 opacity-80")}
    >
      {renaming ? (
        <div className="flex h-9 items-center gap-3 rounded-[10px] bg-surface-2 px-2.5">
          <TopicIcon name={topic.icon} color={topic.color} />
          <input
            autoFocus
            defaultValue={topic.name}
            maxLength={80}
            aria-label="Themenname"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => onRename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRename(e.currentTarget.value);
              if (e.key === "Escape") onCancelRename();
            }}
          />
        </div>
      ) : (
        <Link
          href={`/t/${topic.slug}`}
          title={collapsed ? topic.name : undefined}
          {...attributes}
          {...listeners}
          className={cn(
            "flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[14px] transition-colors",
            active ? "bg-surface-3 text-text" : "text-text-2 hover:bg-surface-2 hover:text-text",
            collapsed && "justify-center px-0",
          )}
        >
          <TopicIcon name={topic.icon} color={topic.color} />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{topic.name}</span>}
          {!collapsed && <span className="w-6 shrink-0" />}
        </Link>
      )}
      {!renaming && menu && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{menu}</div>}
    </li>
  );
}
