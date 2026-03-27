import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { ConvexClerkProvider } from "../lib/convex"
import { LocaleSyncProvider } from "../lib/hooks/locale-sync-provider"
import { ThemeProvider } from "../themes/theme-provider"
import { GlassToaster } from "../components/glass/glass-toaster"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DiveDispatch",
  description: "Multi-stakeholder booking platform for scuba diving",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={inter.className}>
        {/* Provider order is critical: ClerkProvider > ConvexProviderWithClerk > ThemeProvider */}
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/sign-up"
        >
          <ConvexClerkProvider>
            <ThemeProvider>
              <NextIntlClientProvider messages={messages}>
                <LocaleSyncProvider>
                  {children}
                  <GlassToaster />
                </LocaleSyncProvider>
              </NextIntlClientProvider>
            </ThemeProvider>
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
