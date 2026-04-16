import { getTranslations } from 'next-intl/server'
import { PageTitle } from '@/components/ui/page-title'

export default async function TermsPage() {
  const t = await getTranslations('auth')
  const tCommon = await getTranslations('common')

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <PageTitle title={t('termsPageTitle')} description={tCommon('comingSoonPeriod')} />
    </main>
  )
}
