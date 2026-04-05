import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Anchor } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function Home() {
  const t = await getTranslations()

  return (
    <div className="min-h-screen relative">
      <div className="bg-image" />
      <div className="bg-overlay" />
      <main
        className="app-shell min-h-screen flex flex-col items-center justify-center px-4 py-16 relative"
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
            className="text-xl font-medium text-secondary"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            DiveDispatch
          </span>
        </div>
        <h1
          className="text-4xl font-bold tracking-tight text-primary"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("app.tagline")}
        </h1>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link href="/sign-up" className="flex-1">
          <Button variant="primary" size="lg" fullWidth>
            {t("auth.signUp")}
          </Button>
        </Link>
        <Link href="/sign-in" className="flex-1">
          <Button variant="secondary" size="lg" fullWidth>
            {t("auth.signIn")}
          </Button>
        </Link>
      </div>
    </main>
    </div>
  )
}
