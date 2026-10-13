import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-8 pt-32 text-center">
      <h1 className="font-serif text-3xl font-medium">Nicht gefunden</h1>
      <p className="mt-2 text-muted">Diese Seite gibt es nicht (mehr).</p>
      <Link href="/" className="mt-6 inline-block text-accent hover:underline">
        Zur Startseite
      </Link>
    </div>
  );
}
