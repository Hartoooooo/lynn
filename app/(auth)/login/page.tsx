import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-5 font-serif text-3xl font-medium tracking-tight">Willkommen bei Lynn</h1>
          <p className="mt-2 text-muted">Die zentrale Wissensbasis für den Aktienplatz.</p>
        </div>
        <LoginForm initialError={error ? "Der Anmeldelink ist ungültig oder abgelaufen." : null} />
      </div>
    </main>
  );
}
