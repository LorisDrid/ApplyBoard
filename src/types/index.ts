export type { Application, EmailRecord, ApplicationStatus } from "@prisma/client";

// Status labels for UI display
export const STATUS_LABELS: Record<string, string> = {
  SENT: "Envoyé",
  VIEWED: "Consulté",
  INTERVIEW: "Entretien",
  OFFER: "Offre",
  REJECTED: "Refusé",
  GHOSTED: "Sans réponse",
};

// Status colors for UI
export const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-yellow-100 text-yellow-800",
  INTERVIEW: "bg-purple-100 text-purple-800",
  OFFER: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  GHOSTED: "bg-gray-100 text-gray-800",
};
