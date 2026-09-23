const TOKYO_TIME_ZONE = 'Asia/Tokyo'

const tokyoDateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TOKYO_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
})

const tokyoTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TOKYO_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
})

function dateValue(value: Date | string) {
    return value instanceof Date ? value : new Date(value)
}

export function formatTokyoDateTime(value: Date | string) {
    return tokyoDateTimeFormatter.format(dateValue(value))
}

export function formatTokyoTime(value: Date | string) {
    return tokyoTimeFormatter.format(dateValue(value))
}

export function formatTokyoDate(value: Date | string) {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: TOKYO_TIME_ZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).format(dateValue(value))
}

/** Convert an instant to a local Date whose fields represent Tokyo wall-clock time. */
export function toTokyoWallClock(value: Date | string) {
    const instant = dateValue(value)
    const parts = tokyoDateTimeFormatter.formatToParts(instant)
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'), instant.getMilliseconds())
}

/** Convert a Date whose fields represent Tokyo wall-clock time back to an instant. */
export function fromTokyoWallClock(value: Date) {
    return new Date(Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours() - 9,
        value.getMinutes(),
        value.getSeconds(),
        value.getMilliseconds(),
    ))
}

export function formatTokyoDateTimeLocal(value: Date | string) {
    const instant = dateValue(value)
    const parts = tokyoDateTimeFormatter.formatToParts(instant)
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
    const pad = (number: number) => String(number).padStart(2, '0')
    return `${get('year')}-${pad(get('month'))}-${pad(get('day'))}T${pad(get('hour'))}:${pad(get('minute'))}`
}

export function parseTokyoDateTimeLocal(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
    if (!match) return null
    const [, year, month, day, hour, minute] = match.map(Number)
    return new Date(Date.UTC(year, month - 1, day, hour - 9, minute))
}
