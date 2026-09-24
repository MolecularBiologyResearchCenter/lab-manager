'use client'

import { useUserLanguage } from '@/components/UserLanguageProvider'

export default function LanguageSwitcher() {
    const { language, setLanguage, t } = useUserLanguage()

    return (
        <div className="flex items-center rounded-lg border border-white/20 bg-white/10 p-0.5" aria-label="Language">
            <button
                type="button"
                onClick={() => setLanguage('ja')}
                aria-pressed={language === 'ja'}
                className={`min-h-9 rounded-md px-2 text-xs font-medium transition-colors ${language === 'ja' ? 'bg-white text-blue-700' : 'text-blue-50 hover:bg-white/10'}`}
            >
                {t('languageJapanese')}
            </button>
            <button
                type="button"
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
                className={`min-h-9 rounded-md px-2 text-xs font-medium transition-colors ${language === 'en' ? 'bg-white text-blue-700' : 'text-blue-50 hover:bg-white/10'}`}
            >
                {t('languageEnglish')}
            </button>
        </div>
    )
}
