'use client'

import { useUserLanguage } from '@/components/UserLanguageProvider'
import type { TranslationKey } from '@/lib/i18n'

export default function UserLanguageText({ k }: { k: TranslationKey }) {
    const { t } = useUserLanguage()
    return <>{t(k)}</>
}
