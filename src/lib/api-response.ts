import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'

export const API_ERROR_CODES = {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    INVALID_REQUEST: 'INVALID_REQUEST',
    CONFLICT: 'CONFLICT',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]

const requestStarts = new Map<string, number>()

export function createRequestId() {
    const requestId = randomUUID()
    requestStarts.set(requestId, performance.now())
    return requestId
}

export function apiHeaders(requestId: string) {
    const startedAt = requestStarts.get(requestId)
    const durationMs = startedAt === undefined ? undefined : Math.round((performance.now() - startedAt) * 100) / 100
    requestStarts.delete(requestId)
    return {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
        ...(durationMs === undefined ? {} : {
            'X-Request-Duration-Ms': String(durationMs),
            'Server-Timing': `total;dur=${durationMs}`,
        }),
    }
}

export function apiErrorResponse(
    status: number,
    code: ApiErrorCode,
    error: string,
    guidance: string,
    requestId = createRequestId(),
) {
    return NextResponse.json({ error, code, guidance, requestId }, {
        status,
        headers: apiHeaders(requestId),
    })
}

export function apiSuccessResponse<T>(data: T, requestId = createRequestId()) {
    return NextResponse.json(data, { headers: apiHeaders(requestId) })
}
