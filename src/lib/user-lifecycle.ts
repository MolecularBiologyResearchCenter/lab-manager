export const AFFILIATION_TYPES = ['FACULTY_STAFF', 'GRADUATE_STUDENT', 'UNDERGRADUATE_STUDENT'] as const
export type AffiliationType = typeof AFFILIATION_TYPES[number]

export const ENROLLMENT_STATUSES = ['ACTIVE', 'SUSPENDED', 'GRADUATED', 'RETIRED'] as const
export type EnrollmentStatus = typeof ENROLLMENT_STATUSES[number]

export const affiliationLabels: Record<AffiliationType, string> = {
    FACULTY_STAFF: '教職員',
    GRADUATE_STUDENT: '大学院生',
    UNDERGRADUATE_STUDENT: '学部学生',
}

export const enrollmentStatusLabels: Record<EnrollmentStatus, string> = {
    ACTIVE: '在籍中',
    SUSPENDED: '利用停止',
    GRADUATED: '卒業',
    RETIRED: '退職',
}
