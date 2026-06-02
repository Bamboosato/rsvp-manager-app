import type { ReactNode } from "react";

export function AuthPageShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-heading">
        <p className="eyebrow">RSVP Hub</p>
        <h1 id="auth-heading">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
    </main>
  );
}
