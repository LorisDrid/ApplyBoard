import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.1, // Low temperature for consistent extraction
  },
});

export interface EmailAnalysis {
  company: string;
  position: string;
  status: "SENT" | "VIEWED" | "INTERVIEW" | "OFFER" | "REJECTED" | "GHOSTED";
  confidence: number;
}

const PROMPT = `Tu es un assistant qui analyse des emails liés à des candidatures d'emploi.
Extrais les informations suivantes de l'email ci-dessous et réponds UNIQUEMENT en JSON :

{
  "company": "Nom de l'entreprise qui recrute",
  "position": "Intitulé du poste",
  "status": "SENT | VIEWED | INTERVIEW | OFFER | REJECTED",
  "confidence": 0.0 à 1.0
}

Règles pour le statut :
- SENT : accusé de réception, confirmation d'envoi de candidature
- VIEWED : la candidature a été consultée, profil vu
- INTERVIEW : invitation à un entretien, appel, test technique
- OFFER : proposition d'embauche, offre de contrat
- REJECTED : refus, candidature non retenue, poste pourvu

Si tu ne trouves pas le nom de l'entreprise, utilise le domaine de l'expéditeur.
Si tu ne trouves pas le poste, mets "Non spécifié".
Si le statut n'est pas clair, mets SENT avec une confidence basse.

Email à analyser :
---
De : {from}
Objet : {subject}
Contenu : {body}
---`;

export async function analyzeEmail(
  from: string,
  subject: string,
  body: string
): Promise<EmailAnalysis> {
  try {
    // Truncate body to avoid token limits
    const truncatedBody = body.slice(0, 3000);

    const prompt = PROMPT
      .replace("{from}", from)
      .replace("{subject}", subject)
      .replace("{body}", truncatedBody);

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const analysis: EmailAnalysis = JSON.parse(text);

    // Validate status
    const validStatuses = ["SENT", "VIEWED", "INTERVIEW", "OFFER", "REJECTED"];
    if (!validStatuses.includes(analysis.status)) {
      analysis.status = "SENT";
      analysis.confidence = 0.3;
    }

    return analysis;
  } catch (error) {
    console.error("AI analysis error:", error);
    // Return a safe default
    return {
      company: extractCompanyFromEmail(from),
      position: "Non spécifié",
      status: "SENT",
      confidence: 0.1,
    };
  }
}

// Fallback: extract company name from email address
function extractCompanyFromEmail(from: string): string {
  const match = from.match(/@([^.>]+)/);
  if (match) {
    const domain = match[1];
    // Capitalize first letter
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return "Inconnu";
}
