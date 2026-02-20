"use client";

import { STATUS_LABELS } from "@/types";
import ApplicationCard from "./ApplicationCard";

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

interface KanbanBoardProps {
  applications: Application[];
  onCardClick: (app: Application) => void;
}

const COLUMNS = ["SENT", "VIEWED", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"];

const COLUMN_ACCENT: Record<string, string> = {
  SENT: "bg-blue-500",
  VIEWED: "bg-yellow-500",
  INTERVIEW: "bg-purple-500",
  OFFER: "bg-green-500",
  REJECTED: "bg-red-500",
  GHOSTED: "bg-gray-400",
};

export default function KanbanBoard({ applications, onCardClick }: KanbanBoardProps) {
  const grouped = COLUMNS.reduce((acc, status) => {
    acc[status] = applications.filter((app) => app.status === status);
    return acc;
  }, {} as Record<string, Application[]>);

  return (
    <div className="flex gap-3 p-6 h-full overflow-x-auto">
      {COLUMNS.map((status) => (
        <div
          key={status}
          className="min-w-56 flex-1 flex flex-col bg-foreground/[0.02] rounded-xl border border-foreground/[0.04]"
        >
          {/* Column header */}
          <div className="px-4 py-3 flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${COLUMN_ACCENT[status]}`} />
            <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
            <span className="ml-auto text-xs text-muted bg-foreground/[0.04] px-2 py-0.5 rounded-full">
              {grouped[status].length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex-1 px-3 pb-3 space-y-2.5 overflow-auto">
            {grouped[status].length === 0 ? (
              <div className="py-8 text-center text-xs text-muted/50">
                Aucune candidature
              </div>
            ) : (
              grouped[status].map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onClick={() => onCardClick(app)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
