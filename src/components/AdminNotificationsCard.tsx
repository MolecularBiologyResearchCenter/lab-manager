'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { showError } from '@/lib/error-notifier'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTokyoDateTime } from '@/lib/date-format'

interface AdminNotification {
    id: string
    type: string
    name: string
    department: string | null
    laboratory: string | null
    employeeId: string | null
    fiscalYear: number | null
    quarter: number | null
    createdAt: string
    isRead: boolean
}

export default function AdminNotificationsCard() {
    const [notifications, setNotifications] = useState<AdminNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [showAll, setShowAll] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const faviconUpdateId = useRef(0)

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/notifications', { cache: 'no-store' })
            if (!response.ok) {
                setLoadError(true)
                return
            }
            const data = await response.json() as { unreadCount: number; notifications: AdminNotification[] }
            setLoadError(false)
            setUnreadCount(data.unreadCount)
            setNotifications(data.notifications)
        } catch (error) {
            console.error('管理者通知の取得に失敗しました。', error)
        }
    }, [])

    useEffect(() => {
        void fetchNotifications()
        const intervalId = window.setInterval(() => void fetchNotifications(), 12000)
        const refreshOnFocus = () => void fetchNotifications()
        const refreshOnVisibility = () => {
            if (document.visibilityState === 'visible') void fetchNotifications()
        }
        window.addEventListener('focus', refreshOnFocus)
        document.addEventListener('visibilitychange', refreshOnVisibility)
        return () => {
            window.clearInterval(intervalId)
            window.removeEventListener('focus', refreshOnFocus)
            document.removeEventListener('visibilitychange', refreshOnVisibility)
        }
    }, [fetchNotifications])

    useEffect(() => {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            link.href = '/favicon.ico'
            document.head.appendChild(link)
        }
        if (!link.dataset.originalHref) link.dataset.originalHref = link.href || '/favicon.ico'
        const originalHref = link.dataset.originalHref
        const updateId = ++faviconUpdateId.current
        if (unreadCount === 0) {
            link.href = link.dataset.originalHref
            return
        }

        const image = new Image()
        image.onload = () => {
            if (updateId !== faviconUpdateId.current) return
            const canvas = document.createElement('canvas')
            canvas.width = 32
            canvas.height = 32
            const context = canvas.getContext('2d')
            if (!context) return
            context.drawImage(image, 0, 0, 32, 32)
            context.fillStyle = '#dc2626'
            context.beginPath()
            context.arc(25, 7, 6, 0, Math.PI * 2)
            context.fill()
            link.href = canvas.toDataURL('image/png')
        }
        image.onerror = () => {
            if (updateId !== faviconUpdateId.current) return
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1d4ed8"/><circle cx="25" cy="7" r="6" fill="#dc2626"/></svg>`
            link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
        }
        image.src = originalHref
    }, [unreadCount])

    const markNotificationRead = async (notificationId: string) => {
        const notification = notifications.find((item) => item.id === notificationId)
        if (!notification || notification.isRead) return

        try {
            const response = await fetch(`/api/admin/notifications/${notificationId}/read`, { method: 'POST' })
            if (!response.ok) {
                showError('通知を確認済みにできませんでした。')
                return
            }
            setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, isRead: true } : item))
            setUnreadCount((current) => Math.max(0, current - 1))
        } catch (error) {
            console.error('管理者通知の既読化に失敗しました。', error)
            showError('通知を確認済みにできませんでした。')
        }
    }

    const visibleNotifications = showAll ? notifications : notifications.slice(0, 3)

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-700" />
                    管理者通知
                    {unreadCount > 0 && (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                            {unreadCount}
                        </span>
                    )}
                </CardTitle>
                {notifications.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
                        {showAll ? '閉じる' : 'すべて見る'}
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {loadError ? (
                    <p className="text-sm text-amber-700">通知を取得できませんでした。時間をおいて再試行します。</p>
                ) : notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">通知はありません。</p>
                ) : (
                    <div className="max-h-[23rem] space-y-3 overflow-y-auto pr-1">
                        {visibleNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`rounded-xl border p-4 ${notification.isRead ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50'}`}
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        {notification.type === 'INVOICE_ISSUE_REMINDER' ? (
                                            <>
                                                <p className="font-medium text-slate-800">請求書を発行してください</p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {notification.fiscalYear}年 第{notification.quarter}期の請求書が未発行です。
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="font-medium text-slate-800">
                                                    <Link href="/admin/users" className="hover:text-blue-700 hover:underline">
                                                        {notification.isRead ? '新規登録を確認済み' : '新規登録があります'}：{notification.name}
                                                    </Link>
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {notification.department || '学部未登録'} / {notification.laboratory || '所属・研究室未登録'}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    職員番号：{notification.employeeId || '未登録'} ・ 登録日時：{formatTokyoDateTime(notification.createdAt)}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    {!notification.isRead && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => markNotificationRead(notification.id)}
                                            className="shrink-0"
                                        >
                                            <Check className="mr-1 h-4 w-4" />
                                            確認済みにする
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
