'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MESSAGE_EVENT, type TemporaryMessageDetail, type TemporaryMessageKind } from '@/lib/error-notifier'
import { translateErrorMessage } from '@/lib/i18n'
import { useUserLanguage } from '@/components/UserLanguageProvider'
import { CheckCircle2, CircleAlert, CircleX, Info } from 'lucide-react'

type QueuedMessage = TemporaryMessageDetail & { id: number }

const kindStyles: Record<TemporaryMessageKind, { title: string; titleEn: string; border: string; button: string; icon: ReactNode }> = {
    error: { title: 'エラー', titleEn: 'An error occurred', border: 'border-red-200', button: 'bg-red-700 hover:bg-red-800 focus-visible:ring-red-500', icon: <CircleX className="size-7 text-red-700" aria-hidden="true" /> },
    success: { title: '完了', titleEn: 'Completed', border: 'border-emerald-200', button: 'bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-500', icon: <CheckCircle2 className="size-7 text-emerald-700" aria-hidden="true" /> },
    warning: { title: '警告', titleEn: 'Warning', border: 'border-amber-200', button: 'bg-amber-700 hover:bg-amber-800 focus-visible:ring-amber-500', icon: <CircleAlert className="size-7 text-amber-700" aria-hidden="true" /> },
    info: { title: '案内', titleEn: 'Information', border: 'border-blue-200', button: 'bg-blue-700 hover:bg-blue-800 focus-visible:ring-blue-500', icon: <Info className="size-7 text-blue-700" aria-hidden="true" /> },
}

export default function ErrorModal() {
    const { language, t } = useUserLanguage()
    const [messages, setMessages] = useState<QueuedMessage[]>([])
    const okButtonRef = useRef<HTMLButtonElement>(null)
    const nextId = useRef(0)

    const current = messages[0] ?? null

    useEffect(() => {
        const handleMessage = (event: Event) => {
            const detail = (event as CustomEvent<TemporaryMessageDetail>).detail
            const message = typeof detail === 'string'
                ? { message: detail, kind: 'error' as const }
                : detail && typeof detail.message === 'string'
                    ? detail
                    : { message: 'メッセージを表示できませんでした。', kind: 'error' as const }
            setMessages((currentMessages) => [
                ...currentMessages,
                { ...message, id: nextId.current++ },
            ])
        }
        window.addEventListener(MESSAGE_EVENT, handleMessage)
        return () => window.removeEventListener(MESSAGE_EVENT, handleMessage)
    }, [])

    useEffect(() => {
        if (!current) return

        const focusFrame = window.requestAnimationFrame(() => {
            const activeElement = document.activeElement
            if (activeElement instanceof HTMLElement) {
                activeElement.blur()
            }
            okButtonRef.current?.focus()
        })

        return () => window.cancelAnimationFrame(focusFrame)
    }, [current])

    useEffect(() => {
        if (!current) return

        const handleKeyboardClose = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setMessages((currentMessages) => currentMessages.slice(1))
        }

        document.addEventListener('keydown', handleKeyboardClose)
        return () => document.removeEventListener('keydown', handleKeyboardClose)
    }, [current])

    if (!current || typeof document === 'undefined') return null

    const style = kindStyles[current.kind]
    const isEnglish = language === 'en'
    const messageText = current.kind === 'error'
        ? translateErrorMessage(current.message, language)
        : current.message
    const close = () => setMessages((currentMessages) => currentMessages.slice(1))

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div
                role={current.kind === 'error' ? 'alertdialog' : 'dialog'}
                aria-modal="true"
                aria-labelledby="temporary-message-title"
                aria-describedby="temporary-message-content"
                tabIndex={-1}
                className={`flex max-h-[calc(100vh-32px)] w-full max-w-[560px] flex-col rounded-2xl border bg-white p-6 shadow-2xl ${style.border}`}
                onKeyDown={(event) => {
                    event.stopPropagation()
                }}
            >
                <div className="flex shrink-0 items-center gap-3">
                    {style.icon}
                    <h2 id="temporary-message-title" className="text-xl font-bold text-slate-900">
                        {isEnglish ? style.titleEn : style.title}
                    </h2>
                </div>
                <div id="temporary-message-content" className="mt-4 min-h-0 overflow-y-auto whitespace-pre-wrap break-words text-base leading-7 text-slate-800">
                    {messageText}
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
                        className={`rounded-xl px-6 py-3 font-semibold text-white outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 ${style.button}`}
                    >
                        {t('ok')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
