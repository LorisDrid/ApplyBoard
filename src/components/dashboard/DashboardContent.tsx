"use client";

import { useEffect, useState, useCallback } from "react";
import KanbanBoard from "@/components/dashboard/KanbanBoard";

interface EmailRecord {
  receivedAt: string;
}

interface Application {
  id: string;
  company: string;
  position: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  emails?: EmailRecord[];
}

const SYNC_PERIODS = [
  { label: "1 jour", value: 1 },
  { label: "3 jours", value: 3 },
  { label: "7 jours", value: 7 },
  { label: "14 jours", value: 14 },
  { label: "30 jours", value: 30 },
];

export default function DashboardContent() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncDays, setSyncDays] = useState(3);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
      }
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: syncDays }),
      });
      const data = await res.json();

      if (res.ok) {
        setSyncMessage(`${data.processed} nouveau(x) email(s) traité(s)`);
        await fetchApplications();
      } else {
        setSyncMessage(`Erreur : ${data.error}`);
      }
    } catch {
      setSyncMessage("Erreur de connexion");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-foreground/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Mes candidatures
            </h1>
            <p className="text-sm text-muted mt-1">
              {applications.length} candidature{applications.length !== 1 ? "s" : ""} suivie{applications.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {syncMessage && (
              <span className="text-sm text-muted animate-fade-in">
                {syncMessage}
              </span>
            )}

            {/* Period selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted whitespace-nowrap">Période</label>
              <select
                value={syncDays}
                onChange={(e) => setSyncDays(Number(e.target.value))}
                disabled={syncing}
                className="text-sm px-2.5 py-2 rounded-lg border border-foreground/[0.12] bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer"
              >
                {SYNC_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </button>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <svg className="w-16 h-16 text-muted/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <div className="text-center">
              <p className="text-muted font-medium">Aucune candidature</p>
              <p className="text-sm text-muted/60 mt-1">
                Cliquez sur &quot;Synchroniser&quot; pour scanner vos emails
              </p>
            </div>
          </div>
        ) : (
          <KanbanBoard applications={applications} />
        )}
      </div>
    </div>
  );
}
