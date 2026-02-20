import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { fetchEmails } from "@/lib/gmail/client";
import {
  preFilterEmail,
  analyzeJobEmail,
  classifyAndAnalyzeEmail,
} from "@/lib/ai/analyzer";
import type { EmailAnalysis } from "@/lib/ai/analyzer";

// ─── Rate Limiting Config ──────────────────────────────────
// Gemini free tier: 15 RPM, 1500 RPD
// We space calls to stay well under 15 RPM:
// 60s / 15 = 4s minimum, we use 5s for safety margin
let isSyncing = false;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (isSyncing) {
    return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
  }
  isSyncing = true;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const startTime = Date.now();

  try {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`[Sync] Starting sync for user ${userId}`);
    console.log(`${"═".repeat(60)}`);

    // 1. Parse sync period from request body (default: 3 days)
    let newerThanDays = 3;
    try {
      const body = await request.json().catch(() => ({}));
      if (body.days && typeof body.days === 'number' && body.days > 0) {
        newerThanDays = body.days;
      }
    } catch { /* ignore */ }

    console.log(`[Sync] Sync period: last ${newerThanDays} day(s)`);

    // 1. Fetch emails from Gmail (oldest first)
    const emails = await fetchEmails(userId, 50, newerThanDays);

    if (emails.length === 0) {
      console.log("[Sync] No new emails found");
      return NextResponse.json({
        message: "No new emails found",
        processed: 0,
      });
    }

    // 2. Pre-filter all emails BEFORE any AI calls
    console.log(`\n[Sync] ── Pre-filtering ${emails.length} emails ──`);

    const trusted: typeof emails = [];
    const unknown: typeof emails = [];
    const noise: typeof emails = [];

    for (const email of emails) {
      const filter = preFilterEmail(email.from, email.subject);

      switch (filter.decision) {
        case "trusted":
          console.log(`[Filter] ✅ TRUSTED: "${email.subject}" — ${filter.reason}`);
          trusted.push(email);
          break;
        case "noise":
          console.log(`[Filter] 🗑️ NOISE: "${email.subject}" — ${filter.reason}`);
          noise.push(email);
          break;
        case "unknown":
          console.log(`[Filter] ❓ UNKNOWN: "${email.subject}" — ${filter.reason}`);
          unknown.push(email);
          break;
      }
    }

    console.log(`\n[Sync] Pre-filter results: ${trusted.length} trusted, ${unknown.length} unknown, ${noise.length} noise`);
    console.log(`[Sync] AI calls needed: ${trusted.length + unknown.length} (trusted extraction + unknown classification)\n`);

    // 3. Save noise emails to DB (so we don't re-fetch them)
    for (const email of noise) {
      await prisma.emailRecord.create({
        data: {
          applicationId: null,
          gmailId: email.gmailId,
          subject: email.subject,
          from: email.from,
          snippet: email.snippet,
          detectedStatus: null,
          isJobRelated: false,
          receivedAt: email.receivedAt,
        },
      }).catch(() => {
        // Ignore duplicate gmailId errors
      });
    }

    // 4. Process trusted + unknown emails with AI
    let processed = 0;
    let skipped = noise.length;
    let aiCallCount = 0;
    let dailyQuotaHit = false;

    // Process trusted emails first (they're guaranteed to produce results),
    // then unknown emails (which might be filtered out)
    const toProcess = [...trusted, ...unknown];

    for (let i = 0; i < toProcess.length; i++) {
      const email = toProcess[i];
      const isTrusted = i < trusted.length;

      try {
        let analysis: EmailAnalysis;

        if (isTrusted) {
          analysis = await analyzeJobEmail(email.from, email.subject, email.body);
        } else {
          analysis = await classifyAndAnalyzeEmail(email.from, email.subject, email.body);
        }
        aiCallCount++;

        // If not job-related (only possible for unknown emails), save and skip
        if (!analysis.isJobRelated) {
          await prisma.emailRecord.create({
            data: {
              applicationId: null,
              gmailId: email.gmailId,
              subject: email.subject,
              from: email.from,
              snippet: email.snippet,
              detectedStatus: null,
              isJobRelated: false,
              receivedAt: email.receivedAt,
            },
          }).catch(() => {});
          skipped++;
          continue;
        }

        // Find or create the application
        let application = await prisma.application.findFirst({
          where: {
            userId,
            company: { equals: analysis.company, mode: "insensitive" },
            position: { equals: analysis.position, mode: "insensitive" },
          },
        });

        if (!application) {
          application = await prisma.application.create({
            data: {
              userId,
              company: analysis.company,
              position: analysis.position,
              status: analysis.status,
            },
          });
          console.log(`[Sync] 📋 New: ${analysis.company} — ${analysis.position} [${analysis.status}]`);
        } else {
          const statusOrder = ["SENT", "VIEWED", "INTERVIEW", "OFFER", "REJECTED"];
          const currentIndex = statusOrder.indexOf(application.status);
          const newIndex = statusOrder.indexOf(analysis.status);

          if (newIndex > currentIndex) {
            await prisma.application.update({
              where: { id: application.id },
              data: { status: analysis.status },
            });
            console.log(`[Sync] 📋 Updated: ${analysis.company} ${application.status} → ${analysis.status}`);
          } else {
            console.log(`[Sync] 📋 Exists: ${analysis.company} (already ${application.status})`);
          }
        }

        // Save email record
        await prisma.emailRecord.create({
          data: {
            applicationId: application.id,
            gmailId: email.gmailId,
            subject: email.subject,
            from: email.from,
            snippet: email.snippet,
            detectedStatus: analysis.status,
            isJobRelated: true,
            receivedAt: email.receivedAt,
          },
        });

        processed++;
      } catch (emailError) {
        console.error(`[Sync] ❗ Error processing "${email.subject}":`, emailError);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[Sync] ✅ Done in ${elapsed}s`);
    console.log(`[Sync]    ${processed} applications processed`);
    console.log(`[Sync]    ${skipped} emails skipped (noise/not job-related)`);
    console.log(`[Sync]    ${aiCallCount} AI calls made`);
    console.log(`${"─".repeat(60)}\n`);

    return NextResponse.json({
      message: `Synced ${processed} new applications`,
      processed,
      skipped,
      aiCalls: aiCallCount,
      total: emails.length,
      elapsed: `${elapsed}s`,
    });
  }
   catch (error) {
    console.error("[Sync] ❗ Sync error:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  finally {
    isSyncing = false; // Très important
  }
}
