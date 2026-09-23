'use client'

import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function AdminNotifications() {
    const [notifications, setNotifications] = useState<AdminNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        fetchNotifications()
    }, [])

    useEffect(() => {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            link.href = '/favicon.ico'
            document.head.appendChild(link)
        }
        if (!link.dataset.originalHref) link.dataset.originalHref = link.href || '/favicon.ico'
        if (unreadCount > 0) {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1d4ed8"/><circle cx="25" cy="7" r="7" fill="#dc2626"/></svg>'
            link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
        } else {
            link.href = link.dataset.originalHref
        }
    }, [unreadCount])

    const fetchNotifications = async () => {
        try {
            const response = await fetch('/api/admin/notifications', { cache: 'no-store' })
            if (!response.ok) return
            const data = await response.json() as { unreadCount: number; notifications: AdminNotification[] }
            setUnreadCount(data.unreadCount)
            setNotifications(data.notifications)
        } catch (error) {
            console.error('管理者通知の取得に失敗しました。', error)
        }
    }

    const markNotificationRead = async (notificationId: string) => {
        const notification = notifications.find((item) => item.id === notificationId)
        if (!notification || notification.isRead) return

        try {
            const response = await fetch(`/api/admin/notifications/${notificationId}/read`, { method: 'POST' })
            if (!response.ok) {
                toast.error('通知を確認済みにできませんでした。')
                return
            }
            setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, isRead: true } : item))
            setUnreadCount((current) => Math.max(0, current - 1))
        } catch (error) {
            console.error('管理者通知の既読化に失敗しました。', error)
            toast.error('通知を確認済みにできませんでした。')
        }
    }

    return (
        <Card>
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
            </CardHeader>
            <CardContent>
                {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">通知はありません。</p>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((notification) => (
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
                                                    {notification.isRead ? '新規登録を確認済み' : '新規登録があります'}：{notification.name}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {notification.department || '学部未登録'} / {notification.laboratory || '所属・研究室未登録'}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    職員番号：{notification.employeeId || '未登録'} ・ 登録日時：{new Date(notification.createdAt).toLocaleString('ja-JP')}
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
