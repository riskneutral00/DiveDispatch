import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '../../messages/en.json'
import { ThemeContext } from '@/themes/theme-provider'
import { type ThemeContextValue } from '@/themes/theme-types'
import { SKINS } from '@/themes/skins'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

// Stub Convex client — component tests don't hit the backend.
// ConvexProvider still satisfies useQuery/useMutation hooks at the type level;
// individual tests mock return values via vi.mock().
const stubClient = new ConvexReactClient('https://stub.convex.cloud')

// Minimal ThemeContext value so useTheme() doesn't throw
const stubTheme: ThemeContextValue = {
  theme: SKINS[0],
  mode: 'dark',
  setTheme: () => {},
  setMode: () => {},
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
