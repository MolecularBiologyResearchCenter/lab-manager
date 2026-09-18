import nodemailer from 'nodemailer'

type SendEmailResult = {
    sent: boolean
    configured: boolean
}

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<SendEmailResult> {
    const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    if (!configured) {
        console.warn('SMTP settings are not configured. Email not sent.')
        return { sent: false, configured: false }
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    })

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
    })

    return { sent: true, configured: true }
}
