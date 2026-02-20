# ApplyBoard

> Automatic job application tracker powered by Gmail and AI.

ApplyBoard connects to your Gmail account, scans your emails for job-related activity, and uses an LLM to extract company names, positions, and application statuses — then organizes everything into a Kanban board automatically.

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma)
![Groq](https://img.shields.io/badge/Groq_LLaMA_3.3-F55036?style=flat-square)

---

## How it works

1. **OAuth authentication** — User signs in with Google via NextAuth.js
2. **Gmail scan** — The app queries the Gmail API with a curated search query targeting job-related senders and subjects
3. **Multi-stage email filtering** — A rule-based pre-filter classifies each email as *trusted* (known job platforms), *noise* (marketing, alerts, social), or *unknown* (requires AI) — avoiding unnecessary AI calls
4. **AI analysis** — Emails that need it are sent to LLaMA 3.3 70B via Groq. Trusted emails go through extraction-only; unknown senders go through full classification + extraction
5. **Kanban board** — Results are stored in PostgreSQL and displayed in a live Kanban with 6 status columns

```
Gmail API → Pre-filter → [Groq LLaMA 3.3] → PostgreSQL → Kanban UI
```

---

## Features

- **Zero manual input** — applications are detected and logged automatically from your inbox
- **Smart email filtering** — rule-based pre-filter eliminates job alerts, newsletters, and social noise before any AI call
- **Status detection** — AI distinguishes between application sent, viewed, interview invite, offer, and rejection
- **Configurable sync window** — choose to scan the last 1, 3, 7, 14, or 30 days
- **Email timeline** — click any card to open a detail drawer showing all related emails, with a direct link to open each in Gmail
- **Date-aware cards** — each card shows the real received date of the last associated email
- **Duplicate prevention** — already-processed Gmail IDs are skipped on subsequent syncs

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Auth | NextAuth.js (Google OAuth) |
| Database | PostgreSQL via Neon |
| ORM | Prisma |
| Email | Gmail API (REST) |
| AI | Groq — LLaMA 3.3 70B |

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── sync/route.ts          # Main sync endpoint — orchestrates the pipeline
│   │   ├── applications/route.ts  # Returns applications with email records
│   │   └── auth/                  # NextAuth handlers
│   └── dashboard/                 # Protected dashboard page
├── components/
│   └── dashboard/
│       ├── KanbanBoard.tsx        # Status columns
│       ├── ApplicationCard.tsx    # Clickable card with date display
│       ├── ApplicationDrawer.tsx  # Detail panel with Gmail links
│       └── DashboardContent.tsx   # Sync controls and period selector
└── lib/
    ├── ai/analyzer.ts             # Pre-filter logic + Groq integration
    └── gmail/client.ts            # Gmail API queries and email parsing
```

---

## Local setup

**Prerequisites:** Node.js 20+, a PostgreSQL database (e.g. Neon), a Google Cloud project with Gmail API enabled, a Groq API key.

```bash
git clone https://github.com/your-username/ApplyBoard
cd ApplyBoard
npm install
```

Create a `.env` file:

```env
DATABASE_URL=""
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GROQ_API_KEY=""
```

```bash
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and click **Synchroniser**.

---

## Data model

```prisma
model Application {
  id        String            @id
  company   String
  position  String
  status    ApplicationStatus  // SENT | VIEWED | INTERVIEW | OFFER | REJECTED | GHOSTED
  emails    EmailRecord[]
}

model EmailRecord {
  gmailId        String   @unique
  subject        String
  from           String
  snippet        String?
  detectedStatus ApplicationStatus?
  receivedAt     DateTime
}
```

## Note on Google verification

This app uses sensitive Gmail scopes (`gmail.readonly`) and has not been submitted for Google verification — a process intended for large-scale public applications that takes several weeks and requires a dedicated privacy policy, terms of service, and domain ownership.

As a result, when signing in with Google, you will see a warning screen saying *"Google hasn't verified this app"*. This is expected. To proceed:

1. Click **"Advanced"**
2. Click **"Go to ApplyBoard (unsafe)"**

The app only requests read-only Gmail access and does not store, share, or transmit your email content beyond what is displayed in the UI.

---

*Built as a portfolio project — Loris Drid, Software Engineering alumni at Polytech Nice Sophia (2026)*
