import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Anchor } from "lucide-react"

export default async function Home() {
  const t = await getTranslations()

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: "var(--color-surface)" }}
    >
      {/* Hero */}
      <div className="text-center mb-12 max-w-2xl">
        <div
          className="inline-flex items-center gap-2 mb-6"
          aria-label="DiveDispatch"
        >
          <Anchor
            className="w-5 h-5"
            style={{ color: "var(--color-primary)" }}
          />
          <span
            className="text-xl font-medium"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-text-secondary)",
            }}
          >
            DiveDispatch
          </span>
        </div>
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-text-primary)",
          }}
        >
          {t("app.tagline")}
        </h1>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link href="/sign-up" className="flex-1">
          <button
            className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-medium leading-none border rounded-[var(--border-radius)] transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-text-on-primary)",
              borderColor: "var(--color-primary)",
              transitionDuration: "var(--transition-speed)",
              outlineColor: "var(--color-accent)",
            }}
          >
            {t("auth.signUp")}
          </button>
        </Link>
        <Link href="/sign-in" className="flex-1">
          <button
            className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-medium leading-none border rounded-[var(--border-radius)] transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "var(--color-glass-bg)",
              color: "var(--color-text-primary)",
              borderColor: "var(--color-glass-border)",
              backdropFilter: "blur(var(--glass-blur))",
              WebkitBackdropFilter: "blur(var(--glass-blur))",
              transitionDuration: "var(--transition-speed)",
              outlineColor: "var(--color-accent)",
            }}
          >
            {t("auth.signIn")}
          </button>
        </Link>
      </div>
    </main>
  )
}
