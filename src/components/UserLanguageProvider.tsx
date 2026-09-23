'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { languageStorageKey, translations, type Language, type TranslationKey } from '@/lib/i18n'

type LanguageContextValue = {
    language: Language
    setLanguage: (language: Language) => void
    t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function UserLanguageProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('ja')

    useEffect(() => {
        if (!enabled) return
        const stored = window.localStorage.getItem(languageStorageKey)
        if (stored === 'en' || stored === 'ja') setLanguageState(stored)
    }, [enabled])

    const setLanguage = useCallback((nextLanguage: Language) => {
        if (!enabled) return
        setLanguageState(nextLanguage)
        window.localStorage.setItem(languageStorageKey, nextLanguage)
    }, [enabled])

    const value = useMemo<LanguageContextValue>(() => ({
        language: enabled ? language : 'ja',
        setLanguage,
        t: (key) => translations[enabled ? language : 'ja'][key] ?? translations.ja[key],
    }), [enabled, language, setLanguage])

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useUserLanguage() {
    const context = useContext(LanguageContext)
    if (!context) throw new Error('useUserLanguage must be used inside UserLanguageProvider')
    return context
}
