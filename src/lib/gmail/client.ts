import { prisma } from "@/lib/db/prisma";

// Gmail API base URL
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

// -------------------------------------------------------------------
// Search strategy: we combine platform senders AND job-related subjects
// using parentheses so we get emails that are EITHER from a known job
// platform OR that have a job-related subject line.
// We also add "newer_than:7d" to only look at the last 7 days.
// -------------------------------------------------------------------
const JOB_PLATFORMS = [
  "from:hellowork",
  "from:indeed",
  "from:welcometothejungle",
  "from:linkedin.com",       // more specific than just "linkedin"
  "from:monster",
  "from:apec",
  "from:pole-emploi",
  "from:francetravail",
  "from:glassdoor",
  "from:talent.io",
  "from:mytalentplug",
  "from:jobteaser",
  "from:cadremploi",
].join(" OR ");

const JOB_SUBJECTS = [
  "subject:candidature",
  "subject:entretien",
  "subject:interview",
  "subject:recrutement",
  "subject:(votre candidature)",
  "subject:(your application)",
  "subject:(offre d'emploi)",
].join(" OR ");

function buildSearchQuery(newerThanDays: number): string {
  // (platform emails) OR (job-related subjects), limited to recent period
  return `newer_than:${newerThanDays}d AND ({${JOB_PLATFORMS}} OR {${JOB_SUBJECTS}})`;
}

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{
      mimeType: string;
      body: { data?: string };
    }>;
    body?: { data?: string };
  };
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractTextBody(message: GmailMessageDetail): string {
  const { payload } = message;

  // Try to get text/plain from parts
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data);
    }
    // Fallback to text/html
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return stripHtml(decodeBase64(htmlPart.body.data));
    }
  }

  // Single body (no parts)
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Last resort: use snippet
  return message.snippet;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Get the OAuth access token for a user from the database
async function getAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) return null;

  // Check if token is expired
  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    // Refresh the token
    return refreshAccessToken(account);
  }

  return account.access_token;
}

async function refreshAccessToken(account: {
  id: string;
  refresh_token: string | null;
}): Promise<string | null> {
  if (!account.refresh_token) return null;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Gmail] Failed to refresh token:", data);
      return null;
    }

    // Update token in database
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: data.access_token,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      },
    });

    return data.access_token;
  } catch (error) {
    console.error("[Gmail] Token refresh error:", error);
    return null;
  }
}

export interface FetchedEmail {
  gmailId: string;
  subject: string;
  from: string;
  body: string;
  snippet: string;
  receivedAt: Date;
}

// Fetch job application emails from Gmail
export async function fetchEmails(
  userId: string,
  maxResults = 50,
  newerThanDays = 7
): Promise<FetchedEmail[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error("No valid access token. Please reconnect your Google account.");
  }

  const query = buildSearchQuery(newerThanDays);
  console.log(`[Gmail] Search query: ${query}`);
  console.log(`[Gmail] Max results: ${maxResults}`);

  // Search for matching emails
  const searchUrl = `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const error = await searchRes.json();
    throw new Error(`Gmail search failed: ${error.error?.message ?? searchRes.statusText}`);
  }

  const searchData = await searchRes.json();
  const messages: GmailMessage[] = searchData.messages ?? [];

  console.log(`[Gmail] Found ${messages.length} matching emails`);

  if (messages.length === 0) return [];

  // Filter out already processed emails
  const existingGmailIds = await prisma.emailRecord.findMany({
    where: { gmailId: { in: messages.map((m) => m.id) } },
    select: { gmailId: true },
  });
  const existingIds = new Set(existingGmailIds.map((e) => e.gmailId));
  const newMessages = messages.filter((m) => !existingIds.has(m.id));

  console.log(`[Gmail] ${existingIds.size} already processed, ${newMessages.length} new emails to analyze`);

  if (newMessages.length === 0) return [];

  // Fetch full details for each new email
  const emails: FetchedEmail[] = [];

  for (const msg of newMessages) {
    const detailUrl = `${GMAIL_API}/messages/${msg.id}?format=full`;
    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!detailRes.ok) {
      console.warn(`[Gmail] Failed to fetch message ${msg.id}: ${detailRes.statusText}`);
      continue;
    }

    const detail: GmailMessageDetail = await detailRes.json();
    const headers = detail.payload.headers;

    const email: FetchedEmail = {
      gmailId: detail.id,
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      body: extractTextBody(detail),
      snippet: detail.snippet,
      receivedAt: new Date(parseInt(detail.internalDate)),
    };

    console.log(`[Gmail] Fetched: "${email.subject}" from ${email.from} (${email.receivedAt.toLocaleDateString()})`);
    emails.push(email);
  }

  // Sort oldest first so we process chronologically
  emails.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

  console.log(`[Gmail] ${emails.length} emails ready to analyze (oldest first)`);
  return emails;
}
