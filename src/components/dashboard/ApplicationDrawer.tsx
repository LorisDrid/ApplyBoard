"use client";

import { useEffect } from "react";
import { STATUS_LABELS } from "@/types";

interface EmailRecord {
  id: string;
  gmailId: string;
  subject: string;
  from: string;
  snippet: string | null;
  receivedAt: string;
  detectedStatus: string | null;
}

interface Application {
  id: string;
  company: string;
  position: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  emails: EmailRecord[];
}

interface ApplicationDrawerProps {
  application: Application | null;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-yellow-100 text-yellow-700",
  INTERVIEW: "bg-purple-100 text-purple-700",
  OFFER: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  GHOSTED: "bg-gray-100 text-gray-600",
};

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function gmailLink(gmailId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${gmailId}`;
}

export default function ApplicationDrawer({ application, onClose }: ApplicationDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isOpen = application !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-foreground/[0.06] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {!application ? null : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-foreground/[0.06] flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {application.company}
                </h2>
                <p className="text-sm text-muted mt-0.5 truncate">{application.position}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[application.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[application.status] ?? application.status}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-md hover:bg-foreground/[0.06] text-muted transition-colors cursor-pointer mt-0.5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Meta */}
            <div className="px-5 py-3 border-b border-foreground/[0.06] flex gap-4 text-xs text-muted">
              <span>Ajouté le {formatFullDate(application.createdAt)}</span>
            </div>

            {/* Emails timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                Emails associés ({application.emails.length})
              </h3>

              {application.emails.length === 0 ? (
                <p className="text-sm text-muted/60 text-center py-8">Aucun email associé</p>
              ) : (
                <div className="space-y-3">
                  {application.emails.map((email) => (
                    <div
                      key={email.id}
                      className="p-3.5 rounded-lg border border-foreground/[0.06] bg-background hover:border-foreground/[0.12] transition-colors"
                    >
                      {/* Email subject + date */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium leading-snug">{email.subject || "(sans objet)"}</p>
                        <span className="shrink-0 text-[11px] text-muted mt-0.5">
                          {formatShortDate(email.receivedAt)}
                        </span>
                      </div>

                      {/* From */}
                      <p className="text-xs text-muted truncate mb-2">{email.from}</p>

                      {/* Snippet */}
                      {email.snippet && (
                        <p className="text-xs text-muted/70 line-clamp-2 mb-3 leading-relaxed">
                          {email.snippet}
                        </p>
                      )}

                      {/* Status badge + Gmail link */}
                      <div className="flex items-center justify-between gap-2">
                        {email.detectedStatus && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[email.detectedStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABELS[email.detectedStatus] ?? email.detectedStatus}
                          </span>
                        )}
                        <a
                          href={gmailLink(email.gmailId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          Ouvrir dans Gmail
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
