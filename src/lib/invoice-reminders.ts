export const INVOICE_ISSUE_REMINDER_TYPE = 'INVOICE_ISSUE_REMINDER'

export type InvoiceReminderPeriod = {
    fiscalYear: number
    quarter: 1 | 2 | 3
}

function getTokyoDate(now: Date): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(now)

    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * Returns the billing period whose issue reminder is active on the Tokyo date.
 * Reminders begin on May 1, September 1, and January 1 respectively.
 */
export function getActiveInvoiceReminderPeriod(now: Date): InvoiceReminderPeriod | null {
    const { year, month, day } = getTokyoDate(now)

    if (month >= 5 && month <= 8) {
        return { fiscalYear: year, quarter: 1 }
    }
    if (month >= 9) {
        return { fiscalYear: year, quarter: 2 }
    }
    if (month === 1 && day >= 1) {
        return { fiscalYear: year - 1, quarter: 3 }
    }
    return null
}

export function getInvoiceReminderDedupeKey(period: InvoiceReminderPeriod): string {
    return `invoice-issue:${period.fiscalYear}:q${period.quarter}`
}

export function getInvoicePeriodLabel(period: InvoiceReminderPeriod): string {
    const months = period.quarter === 1 ? '1〜4月' : period.quarter === 2 ? '5〜8月' : '9〜12月'
    return `${period.fiscalYear}年${months}分`
}
