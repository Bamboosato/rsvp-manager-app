import Link from "next/link";
import type { ReactNode } from "react";

type LegalPageShellProps = {
  children: ReactNode;
  description: string;
  title: string;
  updatedAt: string;
};

export function LegalPageShell({
  children,
  description,
  title,
  updatedAt
}: LegalPageShellProps) {
  return (
    <main className="public-page">
      <style>{`.app-footer{display:none}`}</style>
      <header className="public-header">
        <Link
          aria-label="トップへ戻る"
          className="public-brand header-mark brand-mark"
          data-tooltip="トップへ戻る"
          href="/"
        >
          <span>RSVP</span>
          <span>HUB</span>
        </Link>
      </header>

      <article className="legal-content">
        <section className="legal-hero">
          <p className="eyebrow">Legal</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <p className="legal-updated">制定日: {updatedAt}</p>
        </section>

        {children}
      </article>
    </main>
  );
}
