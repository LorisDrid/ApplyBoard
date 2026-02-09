# ApplyBoard

Job application tracker that automatically reads your emails and organizes your applications in a Kanban board using AI.

## Stack

- **Frontend**: Next.js 14 + Tailwind CSS
- **Database**: PostgreSQL (Neon) + Prisma ORM
- **Auth**: NextAuth.js (Google OAuth2)
- **AI**: Google Gemini 2.0 Flash
- **Background Jobs**: BullMQ + Redis (Upstash)

## Getting Started

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Run dev server
npm run dev
```

## Environment Variables

See `.env.example` for required variables. You'll need:

1. A [Neon](https://neon.tech) PostgreSQL database
2. Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)
3. A [Gemini API key](https://aistudio.google.com/apikey)
4. An [Upstash](https://upstash.com) Redis instance
