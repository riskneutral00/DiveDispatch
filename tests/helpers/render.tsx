import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '../../messages/en.json'
import { ThemeContext } from '@/themes/theme-provider'
import { type ThemeContextValue } from '@/themes/theme-types'
import { BOOTSTRAP_FALLBACK_THEME } from '@/themes/default-themes'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

const stubClient = new ConvexReactClient('https://stub.convex.cloud')

const stubTheme: ThemeContextValue = {
  theme: BOOTSTRAP_FALLBACK_THEME,
  mode: 'dark',
  setMode: () => {},
  selectTheme: () => {},
  isLoading: false,
}

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ConvexProvider client={stubClient}>
        <ThemeContext.Provider value={stubTheme}>
          {children}
        </ThemeContext.Provider>
      </ConvexProvider>
    </NextIntlClientProvider>
  )
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react'
export { customRender as render }
