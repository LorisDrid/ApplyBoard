import KanbanBoard from "@/components/dashboard/KanbanBoard";

// Mock data for now — will be replaced with real DB data
const MOCK_APPLICATIONS = [
  {
    id: "1",
    company: "Datadog",
    position: "Frontend Engineer",
    status: "SENT" as const,
    createdAt: new Date("2025-02-01"),
    updatedAt: new Date("2025-02-01"),
  },
  {
    id: "2",
    company: "Mistral AI",
    position: "Full-Stack Developer",
    status: "INTERVIEW" as const,
    createdAt: new Date("2025-01-20"),
    updatedAt: new Date("2025-02-05"),
  },
  {
    id: "3",
    company: "BlaBlaCar",
    position: "Software Engineer",
    status: "SENT" as const,
    createdAt: new Date("2025-02-03"),
    updatedAt: new Date("2025-02-03"),
  },
  {
    id: "4",
    company: "Doctolib",
    position: "React Developer",
    status: "REJECTED" as const,
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-02-02"),
  },
  {
    id: "5",
    company: "Alan",
    position: "Backend Engineer",
    status: "OFFER" as const,
    createdAt: new Date("2025-01-10"),
    updatedAt: new Date("2025-02-08"),
  },
  {
    id: "6",
    company: "Qonto",
    position: "Full-Stack Engineer",
    status: "GHOSTED" as const,
    createdAt: new Date("2025-01-05"),
    updatedAt: new Date("2025-01-05"),
  },
  {
    id: "7",
    company: "Swile",
    position: "Frontend Developer",
    status: "VIEWED" as const,
    createdAt: new Date("2025-01-28"),
    updatedAt: new Date("2025-02-06"),
  },
];

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-foreground/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Mes candidatures
            </h1>
            <p className="text-sm text-muted mt-1">
              {MOCK_APPLICATIONS.length} candidatures suivies
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Synchroniser
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto">
        <KanbanBoard applications={MOCK_APPLICATIONS} />
      </div>
    </div>
  );
}
