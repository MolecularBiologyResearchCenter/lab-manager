export type ApiErrorDetails = {
    error: string
    guidance: string
    requestId: string
    code?: string
}

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MISSING_REQUEST_ID = '問い合わせ番号を取得できませんでした'

export class ApiClientError extends Error {
    readonly guidance: string
    readonly requestId: string
    readonly code?: string

    constructor(details: ApiErrorDetails) {
        super(details.error)
        this.name = 'ApiClientError'
        this.guidance = details.guidance
        this.requestId = details.requestId
        this.code = details.code
    }
}

export async function readApiError(response: Response, fallback: string): Promise<ApiClientError> {
    let payload: Partial<ApiErrorDetails> = {}
    const responseRequestId = response.headers.get('X-Request-ID')?.trim()
    try {
        const body = await response.text()
        const parsed: unknown = body ? JSON.parse(body) : undefined
        if (parsed && typeof parsed === 'object') payload = parsed as Partial<ApiErrorDetails>
    } catch {
        // HTMLや空のレスポンスでも画面を落とさず、代替メッセージを使う。
    }

    const payloadRequestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : ''
    const requestId = REQUEST_ID_PATTERN.test(payloadRequestId)
        ? payloadRequestId
        : responseRequestId && REQUEST_ID_PATTERN.test(responseRequestId)
            ? responseRequestId
            : MISSING_REQUEST_ID

    return new ApiClientError({
        error: typeof payload.error === 'string' ? payload.error : fallback,
        guidance: typeof payload.guidance === 'string' ? payload.guidance : '画面を更新して、もう一度お試しください。',
        requestId,
        code: typeof payload.code === 'string' ? payload.code : undefined,
    })
}

export function formatApiError(error: ApiClientError) {
    return `エラー：${error.message}\n次の操作：${error.guidance}\n問い合わせ番号：${error.requestId}`
}
