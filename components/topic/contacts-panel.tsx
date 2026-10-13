import Link from "next/link";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { Avatar } from "@/components/ui";

export type Contact = {
  label: string;
  person: {
    id: string;
    name: string;
    position: string;
    email: string;
    phone: string;
    teams_url: string;
    avatar_url: string | null;
  } | null;
};

export function ContactsPanel({ contacts, canEdit }: { contacts: Contact[]; canEdit: boolean }) {
  const list = contacts.filter((c) => c.person);
  return (
    <section>
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">Ansprechpartner</h2>
      {list.length === 0 ? (
        <p className="text-[13.5px] text-muted">
          Noch niemand zugeordnet.{" "}
          {canEdit && (
            <Link href="/personal" className="text-accent hover:underline">
              Im Personal zuordnen
            </Link>
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map(({ label, person }) => (
            <li key={person!.id} className="rounded-xl border border-border bg-surface p-3">
              <Link href={`/personal?p=${person!.id}`} className="flex items-center gap-3">
                <Avatar name={person!.name} url={person!.avatar_url} size={34} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-text">{person!.name}</div>
                  <div className="truncate text-[12px] text-faint">
                    {label}
                    {person!.position ? ` · ${person!.position}` : ""}
                  </div>
                </div>
              </Link>
              <div className="mt-2.5 flex gap-1.5">
                {person!.email && (
                  <a href={`mailto:${person!.email}`} className="contact-btn" title={person!.email}>
                    <Mail size={13} /> Mail
                  </a>
                )}
                {person!.phone && (
                  <a href={`tel:${person!.phone.replace(/\s/g, "")}`} className="contact-btn" title={person!.phone}>
                    <Phone size={13} /> Anrufen
                  </a>
                )}
                {person!.teams_url && (
                  <a href={person!.teams_url} target="_blank" rel="noreferrer" className="contact-btn">
                    <MessageSquare size={13} /> Teams
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
