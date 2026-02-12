import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { fetchEmails } from "@/lib/gmail/client";
import { analyzeEmail } from "@/lib/ai/analyzer";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 1. Fetch emails from Gmail
    const emails = await fetchEmails(userId, 10);

    if (emails.length === 0) {
      return NextResponse.json({
        message: "No new emails found",
        processed: 0,
      });
    }

    let processed = 0;

    // 2. Analyze each email with AI and save results (with rate limiting)
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      // Wait 2 seconds between each API call to respect rate limits
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      try {
        const analysis = await analyzeEmail(
          email.from,
          email.subject,
          email.body
        );

        // Find or create the application
        let application = await prisma.application.findFirst({
          where: {
            userId,
            company: { equals: analysis.company, mode: "insensitive" },
            position: { equals: analysis.position, mode: "insensitive" },
          },
        });

        if (!application) {
          // Create new application
          application = await prisma.application.create({
            data: {
              userId,
              company: analysis.company,
              position: analysis.position,
              status: analysis.status,
            },
          });
        } else {
          // Update status if the new one is "more advanced"
          const statusOrder = ["SENT", "VIEWED", "INTERVIEW", "OFFER", "REJECTED"];
          const currentIndex = statusOrder.indexOf(application.status);
          const newIndex = statusOrder.indexOf(analysis.status);

          if (newIndex > currentIndex) {
            await prisma.application.update({
              where: { id: application.id },
              data: { status: analysis.status },
            });
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
            receivedAt: email.receivedAt,
          },
        });

        processed++;
      } catch (emailError) {
        console.error(`Error processing email ${email.gmailId}:`, emailError);
        // Continue with next email
      }
    }

    return NextResponse.json({
      message: `Synced ${processed} new emails`,
      processed,
      total: emails.length,
    });
  } catch (error) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
