import { NextResponse } from 'next/server'
import { adminUserSelect, getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authorizationStatus } from '@/lib/authorization'
import { API_ERROR_CODES, apiErrorResponse, apiHeaders, createRequestId } from '@/lib/api-response'
import { recordAuditLog } from '@/lib/audit'

const MAX_CSV_RANGE = 500

function csvCell(value: string | null | undefined): string {
    const normalized = value ?? ''
    // Prevent Excel from interpreting exported values as formulas.
    const safeValue = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
    return `"${safeValue.replace(/"/g, '""')}"`
}

function dateOnly(value: Date): string {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(value)
}

function parseNo(value: string | null): number | null {
    if (!value || !/^\d+$/.test(value)) return null
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null
}

export async function GET(request: Request) {
    const requestId = createRequestId()

    try {
        const currentUser = await getAuthenticatedUser()
        const status = authorizationStatus(currentUser, 'ADMIN')
        if (status === 401) {
            return apiErrorResponse(401, API_ERROR_CODES.AUTH_REQUIRED, 'ログインが必要です。', 'ログインしてから、もう一度お試しください。', requestId)
        }
        if (status === 403) {
            return apiErrorResponse(403, API_ERROR_CODES.FORBIDDEN, 'この操作を行う権限がありません。', '管理者権限でログインしてください。', requestId)
        }

        const url = new URL(request.url)
        const startNo = parseNo(url.searchParams.get('startNo'))
        const endNo = parseNo(url.searchParams.get('endNo'))
        if (startNo === null || endNo === null) {
            return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '開始Noと終了Noは1以上の整数で入力してください。', 'Noを入力して、もう一度お試しください。', requestId)
        }
        if (startNo > endNo) {
            return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, '開始Noは終了No以下で入力してください。', 'Noの範囲を確認して、もう一度お試しください。', requestId)
        }
        if (endNo - startNo + 1 > MAX_CSV_RANGE) {
            return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, `一度にダウンロードできるのは${MAX_CSV_RANGE}人までです。`, '範囲を狭めて、もう一度お試しください。', requestId)
        }

        const totalUsers = await prisma.user.count()
        if (endNo > totalUsers) {
            return apiErrorResponse(400, API_ERROR_CODES.INVALID_REQUEST, `指定したNoは存在しません。登録ユーザーは${totalUsers}人です。`, '存在するNoの範囲を指定してください。', requestId)
        }

        const users = await prisma.user.findMany({
            select: adminUserSelect,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            skip: startNo - 1,
            take: endNo - startNo + 1,
        })

        const rows = [
            ['No.', '氏名', '学部', '所属・研究室', '職員番号', '登録日'].map(csvCell).join(','),
            ...users.map((user, index) => [
                String(startNo + index),
                user.name,
                user.department || '',
                user.laboratory || '',
                user.employeeId || '',
                dateOnly(user.createdAt),
            ].map(csvCell).join(',')),
        ]
        const csv = `\uFEFF${rows.join('\r\n')}\r\n`

        await recordAuditLog({
            actor: currentUser,
            action: 'USER_CSV_EXPORT',
            targetType: 'UserExport',
            summary: '利用者情報CSVをダウンロードしました。',
            metadata: { startNo, endNo, userCount: users.length },
        })

        return new NextResponse(csv, {
            headers: {
                ...apiHeaders(requestId),
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename*=UTF-8''user-employee-list-${startNo}-${endNo}.csv`,
            },
        })
    } catch {
        console.error(`[${requestId}] 利用者情報CSVの作成に失敗しました。`)
        return apiErrorResponse(500, API_ERROR_CODES.INTERNAL_ERROR, '利用者情報CSVを作成できませんでした。', '時間をおいて、もう一度お試しください。', requestId)
    }
}
