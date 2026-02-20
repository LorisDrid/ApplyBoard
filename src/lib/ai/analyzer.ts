import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.1,
  },
});

// ─── Types ─────────────────────────────────────────────────

export interface EmailAnalysis {
  company: string;
  position: string;
  status: "SENT" | "VIEWED" | "INTERVIEW" | "OFFER" | "REJECTED" | "GHOSTED";
  confidence: number;
  isJobRelated: boolean;
}

// ─── Pre-filter: known job platform domains ────────────────
// Emails from these domains are ALWAYS job-related → skip the
// "is this a job email?" question and just extract data.
// This avoids wasting AI calls on obvious cases.

// Domains known to be noise — never job-related
const NOISE_DOMAINS = [
  "google.com",
  "gmail.com",
  "microsoft.com",
  "outlook.com",
  "hotmail.com",
  "amazon.com",
  "apple.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "netflix.com",
  "spotify.com",
  "airbnb.com",
  "paypal.com",
  "stripe.com",
  "notion.so",
  "slack.com",
  "github.com",
  "gitlab.com",
  "atlassian.com",
];

// Subject keywords that definitively indicate noise (non-job emails)
const NOISE_SUBJECT_KEYWORDS = [
  "newsletter",
  "offre du moment",
  "promotion",
  "promo",
  "soldes",
  "réduction",
  "remise",
  "% de réduction",
  "commande",
  "livraison",
  "suivi de colis",
  "facture",
  "reçu",
  "paiement",
  "abonnement",
  "compte rendu",
  "verification",
  "vérification",
  "mot de passe",
  "password",
  "2fa",
  "code de sécurité",
  "bienvenue sur",
  "welcome to",
];

const TRUSTED_JOB_DOMAINS = [
  "hellowork.com",
  "reply.hellowork.com",
  "indeed.com",
  "match.indeed.com",
  "jobalert.indeed.com",
  "welcometothejungle.com",
  "monster.fr",
  "monster.com",
  "apec.fr",
  "pole-emploi.fr",
  "francetravail.fr",
  "glassdoor.com",
  "glassdoor.fr",
  "talent.io",
  "mytalentplug.com",
  "jobteaser.com",
  "cadremploi.fr",
];

// LinkedIn senders that confirm a real application was sent
const LINKEDIN_APPLICATION_SENDERS = [
  "jobs-noreply@linkedin.com", // "Your application was sent to X"
];

// LinkedIn senders that are job alerts / suggestions (not real applications)
const LINKEDIN_JOBALERT_SENDERS = [
  "jobs-listings@linkedin.com",     // "X is hiring..."
  "jobalerts-noreply@linkedin.com", // "Ingénieur logiciels: ..."
];

// LinkedIn sub-addresses that are NOT job-related (social noise)
const LINKEDIN_NOISE_SENDERS = [
  "updates-noreply@linkedin.com",
  "invitations@linkedin.com",
  "messages-noreply@linkedin.com",
  "notifications-noreply@linkedin.com",
  "newsletters-noreply@linkedin.com",
];

// Subject patterns that indicate job alerts / suggestions (not real applications)
// These come from trusted platforms but should be discarded
const JOB_ALERT_SUBJECT_PATTERNS = [
  /^\d+ nouvel(le)?s? emploi/i,          // "3 nouveaux emplois..."
  /et \d+ nouveau(x)? poste/i,           // "...et 2 nouveaux postes"
  /jobs? similar to/i,                   // "New jobs similar to..."
  /is hiring a /i,                        // "Company X is hiring a ..."
  /is hiring an /i,
  /recherche un\/e /i,                   // "SFR recherche un/e ..."
  /land a job/i,                          // "Land a job 30% faster"
  /démarquez-vous en envoyant/i,         // Indeed suggestion
  /sont désormais synchronisés/i,        // "Vos profils Glassdoor et Indeed sont désormais synchronisés"
  /est toujours disponible/i,            // "L'emploi chez X est toujours disponible"
  /postulez sans tarder/i,               // Glassdoor job alert
  /your profile is getting/i,            // LinkedIn profile views
  /thanks for being a valued member/i,   // LinkedIn Premium marketing
  /share their thoughts/i,               // LinkedIn social
  /you may know/i,                       // LinkedIn people you may know
];

/**
 * Extracts the email address from a "From" header like:
 * "LinkedIn <jobs-noreply@linkedin.com>" → "jobs-noreply@linkedin.com"
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

/**
 * Extracts the domain from an email address:
 * "jobs-noreply@linkedin.com" → "linkedin.com"
 * "r-c-abc123@reply.hellowork.com" → "reply.hellowork.com"
 */
function extractDomain(emailAddress: string): string {
  const parts = emailAddress.split("@");
  return parts.length > 1 ? parts[1] : emailAddress;
}

export type PreFilterResult =
  | { decision: "trusted"; reason: string }    // Known job platform → send to AI for extraction only
  | { decision: "noise"; reason: string }       // Known noise → skip entirely, no AI needed
  | { decision: "unknown"; reason: string };    // Unknown sender → need AI to decide

/**
 * Pre-filter emails before sending to AI.
 * Returns whether the email is from a trusted job platform, known noise, or unknown.
 */
export function preFilterEmail(from: string, subject: string): PreFilterResult {
  const emailAddress = extractEmailAddress(from);
  const domain = extractDomain(emailAddress);
  const lowerSubject = subject.toLowerCase();

  // Check known noise domains first
  for (const noiseDomain of NOISE_DOMAINS) {
    if (domain === noiseDomain || domain.endsWith("." + noiseDomain)) {
      return { decision: "noise", reason: `Known noise domain: ${noiseDomain}` };
    }
  }

  // Check noise subject keywords
  if (NOISE_SUBJECT_KEYWORDS.some(kw => lowerSubject.includes(kw))) {
    return { decision: "noise", reason: `Noise subject keyword detected: "${subject}"` };
  }

  // Check LinkedIn specifically (same domain, different senders)
  if (domain === "linkedin.com" || domain.endsWith(".linkedin.com")) {
    if (LINKEDIN_NOISE_SENDERS.includes(emailAddress)) {
      return { decision: "noise", reason: `LinkedIn social noise: ${emailAddress}` };
    }
    // Job alert senders → always noise (suggestions, not real applications)
    if (LINKEDIN_JOBALERT_SENDERS.includes(emailAddress)) {
      return { decision: "noise", reason: `LinkedIn job alert (not a real application): ${emailAddress}` };
    }
    if (LINKEDIN_APPLICATION_SENDERS.includes(emailAddress)) {
      // Even from the application sender, check it's not a job alert subject
      if (JOB_ALERT_SUBJECT_PATTERNS.some(p => p.test(subject))) {
        return { decision: "noise", reason: `LinkedIn job alert subject: "${subject}"` };
      }
      return { decision: "trusted", reason: `LinkedIn application confirmation: ${emailAddress}` };
    }
    // Unknown LinkedIn sender → noise by default (LinkedIn noise >> signal)
    return { decision: "noise", reason: `LinkedIn unknown sender: ${emailAddress}` };
  }

  // Check trusted job platform domains (match end of domain for subdomains)
  for (const trustedDomain of TRUSTED_JOB_DOMAINS) {
    if (domain === trustedDomain || domain.endsWith("." + trustedDomain)) {
      // Even from trusted platforms, filter out job alerts and marketing
      if (JOB_ALERT_SUBJECT_PATTERNS.some(p => p.test(subject))) {
        return { decision: "noise", reason: `Job alert / marketing from trusted platform: "${subject}"` };
      }
      return { decision: "trusted", reason: `Trusted job platform: ${trustedDomain}` };
    }
  }

  // Not a known platform → unknown, will need AI
  return { decision: "unknown", reason: `Unknown domain: ${domain}` };
}

// ─── AI Prompts ────────────────────────────────────────────

// Prompt for TRUSTED sources: we know it's job-related, just extract data
const EXTRACT_PROMPT = `Tu es un assistant qui analyse des emails de candidature d'emploi.
L'email ci-dessous provient d'une plateforme d'emploi connue. Extrais les informations.

Réponds UNIQUEMENT en JSON :
{
  "company": "Nom de l'entreprise qui recrute",
  "position": "Intitulé du poste",
  "status": "SENT | VIEWED | INTERVIEW | OFFER | REJECTED",
  "confidence": 0.0 à 1.0
}

Règles pour le statut :
- SENT : accusé de réception, confirmation d'envoi, alerte emploi
- VIEWED : la candidature a été consultée, profil vu par le recruteur
- INTERVIEW : invitation à un entretien, appel, test technique
- OFFER : proposition d'embauche, offre de contrat
- REJECTED : refus, candidature non retenue, poste pourvu

Si tu ne trouves pas le nom de l'entreprise, utilise le nom dans le champ "De".
Si tu ne trouves pas le poste, mets "Non spécifié".

Email :
---
De : {from}
Objet : {subject}
Contenu : {body}
---`;

// Prompt for UNKNOWN sources: need to determine if job-related first
const CLASSIFY_AND_EXTRACT_PROMPT = `Tu es un assistant qui analyse des emails pour déterminer s'ils sont liés à une candidature d'emploi.

ÉTAPE 1 : Détermine si cet email est lié à une candidature.
OUI si c'est : accusé de réception de candidature, notification de consultation, invitation entretien, offre, refus, alerte emploi personnalisée.
NON si c'est : newsletter, notification sociale, email promotionnel, service non lié à l'emploi.

ÉTAPE 2 : Si oui, extrais les informations.

Réponds UNIQUEMENT en JSON :
{
  "isJobRelated": true/false,
  "company": "Nom de l'entreprise (ou 'N/A' si non lié)",
  "position": "Intitulé du poste (ou 'Non spécifié')",
  "status": "SENT | VIEWED | INTERVIEW | OFFER | REJECTED",
  "confidence": 0.0 à 1.0
}

Règles statut : SENT (accusé réception), VIEWED (consulté), INTERVIEW (entretien), OFFER (offre), REJECTED (refus).

Email :
---
De : {from}
Objet : {subject}
Contenu : {body}
---`;

// ─── Rate Limiter ──────────────────────────────────────────

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 15_000; // 15 seconds base (close to Gemini's typical suggested delay)

/**
 * Parse the retryDelay from Gemini's error response.
 * Example: "Please retry in 40.469938856s" → 40470
 */
function parseRetryDelay(errorMessage: string): number | null {
  const match = errorMessage.match(/retry in (\d+\.?\d*)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000);
  }
  return null;
}

/**
 * Detect if the error is a true DAILY quota exhaustion vs a temporary RPM throttle.
 * 
 * Google returns limit: 0 on ALL quotas (including daily) even for RPM throttles,
 * so we can't rely on that. Instead, we check the suggested retry delay:
 * - Short retry (< 5 min) → RPM throttle, just wait and retry
 * - Long retry (> 1 hour) or no retry info → true daily exhaustion, stop
 */
function isDailyQuotaExhausted(errorMessage: string): boolean {
  const retryDelay = parseRetryDelay(errorMessage);
  
  // Si le délai de retry est inférieur à 5 minutes, c'est du RPM (limite par minute)
  // On ne considère que c'est le quota journalier que si le délai est énorme ou absent
  if (retryDelay !== null && retryDelay < 300 * 1000) {
    return false;
  }
  
  // On vérifie si l'erreur 429 est explicitement liée au quota journalier
  // et non juste présente dans les détails du message
  return errorMessage.includes("GenerateRequestsPerDay") && !errorMessage.includes("PerMinute");
}

async function callGeminiWithRetry(prompt: string): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      const isRateLimit =
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("rate") ||
        errorMsg.includes("quota");

      if (!isRateLimit) {
        throw error;
      }

      // Log detailed quota info
      logQuotaDetails(errorMsg);

      // If daily quota is exhausted, stop immediately — retries are pointless
      if (isDailyQuotaExhausted(errorMsg)) {
        console.error("[Gemini] 🛑 Daily quota exhausted! No point retrying. Wait until tomorrow or create a new Google Cloud project.");
        throw new Error("DAILY_QUOTA_EXHAUSTED");
      }

      if (attempt < MAX_RETRIES) {
        // Use the delay suggested by the API, or fallback to exponential backoff
        const suggestedDelay = parseRetryDelay(errorMsg);
        const backoff = suggestedDelay ?? BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Gemini] ⚠️ Rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES + 1}), waiting ${(backoff / 1000).toFixed(1)}s${suggestedDelay ? " (API suggested)" : ""}...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded for Gemini API");
}

/**
 * Parse and log detailed quota information from a Gemini error.
 */
function logQuotaDetails(errorMsg: string): void {
  console.error("[Gemini] 📊 Quota details:");

  // Extract all quota violations
  const violations = [];
  const violationRegex = /quotaMetric.*?quotaDimensions.*?}/gs;
  const matches = errorMsg.match(violationRegex);
  if (matches) {
    for (const m of matches) {
      const metric = m.match(/quotaMetric":"([^"]+)"/)?.[1] ?? "unknown";
      const quotaId = m.match(/quotaId":"([^"]+)"/)?.[1] ?? "unknown";
      violations.push({ metric: metric.split("/").pop(), quotaId });
    }
  }
  if (violations.length > 0) {
    for (const v of violations) {
      const isDaily = v.quotaId.includes("PerDay");
      const isMinute = v.quotaId.includes("PerMinute");
      const isTokens = v.metric?.includes("token");
      const type = isDaily ? "DAILY" : isMinute ? "PER-MINUTE" : "OTHER";
      const what = isTokens ? "tokens" : "requests";
      console.error(`[Gemini]   → ${type} ${what} limit (${v.quotaId})`);
    }
  }

  // Extract retry delay
  const retryMatch = errorMsg.match(/retry in (\d+\.?\d*)s/i);
  if (retryMatch) {
    console.error(`[Gemini]   → Suggested retry: ${retryMatch[1]}s`);
  }
}

// ─── Public API ────────────────────────────────────────────

/**
 * Analyze an email that we KNOW is job-related (from a trusted platform).
 * Only extracts company/position/status — no relevance check.
 */
export async function analyzeJobEmail(
  from: string,
  subject: string,
  body: string
): Promise<EmailAnalysis> {
  try {
    const truncatedBody = body.slice(0, 1500);
    const prompt = EXTRACT_PROMPT
      .replace("{from}", from)
      .replace("{subject}", subject)
      .replace("{body}", truncatedBody);

    console.log(`[Gemini] 📨 Extracting (trusted): "${subject}"`);

    const text = await callGeminiWithRetry(prompt);
    const raw = JSON.parse(text);

    const validStatuses = ["SENT", "VIEWED", "INTERVIEW", "OFFER", "REJECTED"];
    const status = validStatuses.includes(raw.status) ? raw.status : "SENT";

    const analysis: EmailAnalysis = {
      company: raw.company || extractCompanyFromEmail(from),
      position: raw.position || "Non spécifié",
      status,
      confidence: raw.confidence ?? 0.5,
      isJobRelated: true,
    };

    console.log(
      `[Gemini] ✅ ${analysis.company} — ${analysis.position} [${analysis.status}] (${analysis.confidence})`
    );
    return analysis;
  } catch (error) {
    if (error instanceof Error && error.message === "DAILY_QUOTA_EXHAUSTED") {
      throw error; // Propagate to stop the sync loop
    }
    console.error(`[Gemini] ❗ Extraction error for "${subject}":`, error);
    return {
      company: extractCompanyFromEmail(from),
      position: "Non spécifié",
      status: "SENT",
      confidence: 0.1,
      isJobRelated: true, // We know it's trusted, just couldn't extract
    };
  }
}

/**
 * Analyze an email from an UNKNOWN sender.
 * First determines if job-related, then extracts data if so.
 */
export async function classifyAndAnalyzeEmail(
  from: string,
  subject: string,
  body: string
): Promise<EmailAnalysis> {
  try {
    const truncatedBody = body.slice(0, 3000);
    const prompt = CLASSIFY_AND_EXTRACT_PROMPT
      .replace("{from}", from)
      .replace("{subject}", subject)
      .replace("{body}", truncatedBody);

    console.log(`[Gemini] 🔍 Classifying (unknown): "${subject}"`);

    const text = await callGeminiWithRetry(prompt);
    const raw = JSON.parse(text);

    if (!raw.isJobRelated) {
      console.log(`[Gemini] ❌ Not job-related: "${subject}"`);
      return {
        company: "N/A",
        position: "N/A",
        status: "SENT",
        confidence: 0,
        isJobRelated: false,
      };
    }

    const validStatuses = ["SENT", "VIEWED", "INTERVIEW", "OFFER", "REJECTED"];
    const status = validStatuses.includes(raw.status) ? raw.status : "SENT";

    const analysis: EmailAnalysis = {
      company: raw.company || extractCompanyFromEmail(from),
      position: raw.position || "Non spécifié",
      status,
      confidence: raw.confidence ?? 0.5,
      isJobRelated: true,
    };

    console.log(
      `[Gemini] ✅ ${analysis.company} — ${analysis.position} [${analysis.status}] (${analysis.confidence})`
    );
    return analysis;
  } catch (error) {
    if (error instanceof Error && error.message === "DAILY_QUOTA_EXHAUSTED") {
      throw error;
    }
    console.error(`[Gemini] ❗ Classification error for "${subject}":`, error);
    return {
      company: extractCompanyFromEmail(from),
      position: "Non spécifié",
      status: "SENT",
      confidence: 0.1,
      isJobRelated: false, // On error for unknown sender, assume not job-related
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────

function extractCompanyFromEmail(from: string): string {
  // Try to get the display name first: "Recrulab <email@...>" → "Recrulab"
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && name.toLowerCase() !== "linkedin" && name.toLowerCase() !== "indeed") {
      return name;
    }
  }
  // Fallback to domain
  const domainMatch = from.match(/@([^.>]+)/);
  if (domainMatch) {
    const domain = domainMatch[1];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return "Inconnu";
}
