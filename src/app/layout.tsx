import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { ConvexClerkProvider } from "../lib/convex"
import { StoreUserProvider } from "../lib/hooks/store-user-context"
import { LocaleSyncProvider } from "../lib/hooks/locale-sync-provider"
import { ThemeProvider } from "../themes/theme-provider"
import { getThemeBootstrapScript } from "../themes/theme-bootstrap"
import { AppToaster } from "../components/ui/app-toaster"
import { OfflineIndicator } from "../components/pwa/offline-indicator"
import { PostHogProvider } from "../lib/posthog"
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
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script>{getThemeBootstrapScript()}</script>
      </head>
      <body className={inter.className}>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
        >
          <ConvexClerkProvider>
            <StoreUserProvider>
            <PostHogProvider>
            <ThemeProvider>
              <NextIntlClientProvider messages={messages}>
                <LocaleSyncProvider>
                  <OfflineIndicator />
                  {children}
                  <AppToaster />
                </LocaleSyncProvider>
              </NextIntlClientProvider>
            </ThemeProvider>
            </PostHogProvider>
            </StoreUserProvider>
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
