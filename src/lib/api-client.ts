export type ApiErrorDetails = {
    error: string
    guidance: string
    requestId: string
    code?: string
}

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
    try {
        const parsed: unknown = await response.json()
        if (parsed && typeof parsed === 'object') payload = parsed as Partial<ApiErrorDetails>
    } catch {
        // HTMLや空のレスポンスでも画面を落とさず、代替メッセージを使う。
    }

    return new ApiClientError({
        error: typeof payload.error === 'string' ? payload.error : fallback,
        guidance: typeof payload.guidance === 'string' ? payload.guidance : '画面を更新して、もう一度お試しください。',
        requestId: typeof payload.requestId === 'string' ? payload.requestId : '取得できませんでした',
        code: typeof payload.code === 'string' ? payload.code : undefined,
    })
}

export function formatApiError(error: ApiClientError) {
    return `エラー：${error.message}\n次の操作：${error.guidance}\n問い合わせ番号：${error.requestId}`
}
