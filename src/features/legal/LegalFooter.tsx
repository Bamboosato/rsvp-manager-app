"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

type LegalModalKind = "terms" | "privacy";

const legalModalConfig = {
  terms: {
    href: "/terms",
    linkLabel: "Terms",
    title: "利用規約"
  },
  privacy: {
    href: "/privacy",
    linkLabel: "Privacy",
    title: "プライバシーポリシー"
  }
} satisfies Record<LegalModalKind, { href: string; linkLabel: string; title: string }>;

export function LegalFooter() {
  const [modalKind, setModalKind] = useState<LegalModalKind | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeConfig = modalKind ? legalModalConfig[modalKind] : null;

  useEffect(() => {
    if (!modalKind) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalKind(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalKind]);

  function handleLegalLinkClick(event: MouseEvent<HTMLAnchorElement>, nextKind: LegalModalKind) {
    event.preventDefault();
    setModalKind(nextKind);
  }

  return (
    <>
      <footer className="app-footer">
        <span className="footer-copy">© 2026 Bamboosatov1.1.0</span>
        <nav aria-label="法的文書" className="footer-links">
          <a href={legalModalConfig.terms.href} onClick={(event) => handleLegalLinkClick(event, "terms")}>
            {legalModalConfig.terms.linkLabel}
          </a>
          <span aria-hidden="true">|</span>
          <a href={legalModalConfig.privacy.href} onClick={(event) => handleLegalLinkClick(event, "privacy")}>
            {legalModalConfig.privacy.linkLabel}
          </a>
        </nav>
      </footer>

      {activeConfig ? (
        <div
          className="legal-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setModalKind(null);
            }
          }}
        >
          <section
            aria-labelledby="legal-modal-title"
            aria-modal="true"
            className="legal-modal-panel"
            role="dialog"
          >
            <div className="legal-modal-header">
              <div>
                <p className="eyebrow">Legal</p>
                <h2 id="legal-modal-title">{activeConfig.title}</h2>
              </div>
              <button
                aria-label="閉じる"
                className="account-close-button"
                data-tooltip="閉じる"
                onClick={() => setModalKind(null)}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </div>
            <iframe className="legal-modal-frame" src={activeConfig.href} title={activeConfig.title} />
          </section>
        </div>
      ) : null}
    </>
  );
}
