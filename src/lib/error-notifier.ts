export const ERROR_EVENT = 'lab-manager:error'

export function showError(message: string) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: message }))
}
