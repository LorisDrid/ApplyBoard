import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="flex flex-col items-center gap-8 px-6 max-w-lg text-center">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            ApplyBoard
          </h1>
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Vos candidatures,
            <br />
            <span className="text-primary">enfin organisées.</span>
          </h2>
          <p className="text-muted text-lg leading-relaxed max-w-md mx-auto">
            Connectez votre boîte mail et laissez l&apos;IA trier, classer et
            suivre toutes vos candidatures automatiquement.
          </p>
        </div>

        {/* Features pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {["Scan intelligent", "Kanban automatique", "Anti-ghosting"].map(
            (feature) => (
              <span
                key={feature}
                className="px-4 py-1.5 rounded-full text-sm font-medium bg-surface border border-foreground/[0.06] text-muted shadow-sm"
              >
                {feature}
              </span>
            )
          )}
        </div>

        {/* Login button */}
        <LoginButton />

        {/* Privacy note */}
        <p className="text-xs text-muted/60 max-w-sm">
          Seules les métadonnées de vos emails de candidature sont analysées.
          Aucun contenu personnel n&apos;est stocké.
        </p>
      </div>
    </main>
  );
}
