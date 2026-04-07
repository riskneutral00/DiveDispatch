import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Anchor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BackgroundLayout } from "@/components/layout/background-layout"

export default async function Home() {
  const t = await getTranslations()

  return (
    <BackgroundLayout className="items-center justify-center px-4 py-16">
      <div className="text-center mb-12 max-w-2xl">
        <div
          className="inline-flex items-center gap-2 mb-6"
          aria-label="DiveDispatch"
        >
          <Anchor
            className="w-5 h-5 text-primary"
          />
          <span
            className="text-xl font-medium text-secondary font-heading"
          >
            DiveDispatch
          </span>
        </div>
        <h1
          className="text-4xl font-bold tracking-tight text-primary font-heading"
        >
          {t("app.tagline")}
        </h1>
      </div>

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
    </BackgroundLayout>
  )
}
