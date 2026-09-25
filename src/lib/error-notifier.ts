export const MESSAGE_EVENT = 'lab-manager:message'
export const ERROR_EVENT = MESSAGE_EVENT

export type TemporaryMessageKind = 'error' | 'success' | 'warning' | 'info'

export type TemporaryMessageDetail = {
    message: string
    kind: TemporaryMessageKind
}

export function showMessage(message: string, kind: TemporaryMessageKind = 'info') {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent<TemporaryMessageDetail>(MESSAGE_EVENT, {
        detail: { message, kind },
    }))
}

export function showError(message: string) {
    showMessage(message, 'error')
}

export function showSuccess(message: string) {
    showMessage(message, 'success')
}

export function showWarning(message: string) {
    showMessage(message, 'warning')
}

export function showInfo(message: string) {
    showMessage(message, 'info')
}
