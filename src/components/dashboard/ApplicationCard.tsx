interface Application {
  id: string;
  company: string;
  position: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ApplicationCardProps {
  application: Application;
}

function daysAgo(date: Date): string {
  const diff = Math.floor(
    (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return `Il y a ${diff}j`;
}

export default function ApplicationCard({ application }: ApplicationCardProps) {
  const isGhosted = application.status === "GHOSTED";
  const isSentLong =
    application.status === "SENT" &&
    Date.now() - new Date(application.updatedAt).getTime() >
      10 * 24 * 60 * 60 * 1000;

  return (
    <div
      className={`p-3.5 rounded-lg bg-surface border transition-all hover:shadow-md cursor-pointer ${
        isGhosted || isSentLong
          ? "border-red-300/30 bg-red-50/5"
          : "border-foreground/[0.06] hover:border-foreground/[0.12]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold truncate">
            {application.company}
          </h4>
          <p className="text-xs text-muted mt-0.5 truncate">
            {application.position}
          </p>
        </div>
        {(isGhosted || isSentLong) && (
          <span className="shrink-0 text-red-400" title="Sans réponse">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-foreground/[0.04]">
        <span className="text-[11px] text-muted">
          {daysAgo(application.createdAt)}
        </span>
      </div>
    </div>
  );
}
