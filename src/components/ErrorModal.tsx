'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ERROR_EVENT } from '@/lib/error-notifier'
import { translateErrorMessage } from '@/lib/i18n'
import { useUserLanguage } from '@/components/UserLanguageProvider'

export default function ErrorModal() {
    const { language, t } = useUserLanguage()
    const [message, setMessage] = useState<string | null>(null)
    const okButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const handleError = (event: Event) => {
            const detail = (event as CustomEvent<string>).detail
            const activeElement = document.activeElement
            if (activeElement instanceof HTMLElement) {
                activeElement.blur()
            }
            setMessage(typeof detail === 'string' ? detail : 'エラーが発生しました。')
        }
        window.addEventListener(ERROR_EVENT, handleError)
        return () => window.removeEventListener(ERROR_EVENT, handleError)
    }, [])

    useEffect(() => {
        if (!message) return

        const focusFrame = window.requestAnimationFrame(() => {
            const activeElement = document.activeElement
            if (activeElement instanceof HTMLElement) {
                activeElement.blur()
            }
            okButtonRef.current?.focus()
        })

        return () => window.cancelAnimationFrame(focusFrame)
    }, [message])

    useEffect(() => {
        if (!message) return

        const handleKeyboardClose = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setMessage(null)
        }

        document.addEventListener('keydown', handleKeyboardClose)
        return () => document.removeEventListener('keydown', handleKeyboardClose)
    }, [message])

    if (!message || typeof document === 'undefined') return null

    const close = () => setMessage(null)

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="error-modal-title"
                aria-describedby="error-modal-message"
                tabIndex={-1}
                className="flex max-h-[calc(100vh-32px)] w-full max-w-[560px] flex-col rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
                onKeyDown={(event) => {
                    event.stopPropagation()
                }}
            >
                <h2 id="error-modal-title" className="shrink-0 text-xl font-bold text-red-700">
                    {t('errorOccurred')}
                </h2>
                <div id="error-modal-message" className="mt-4 min-h-0 overflow-y-auto whitespace-pre-wrap break-words text-base leading-7 text-slate-800">
                    {translateErrorMessage(message, language)}
                </div>
                <div className="mt-6 flex shrink-0 justify-end">
                    <button
                        ref={okButtonRef}
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            close()
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        className="rounded-xl bg-red-700 px-6 py-3 font-semibold text-white outline-none transition hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                        {t('ok')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
