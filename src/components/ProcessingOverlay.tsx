'use client'

export default function ProcessingOverlay() {
    return <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-4" role="status" aria-live="polite">
        <div className="rounded-xl bg-white px-6 py-4 text-base font-semibold text-slate-900 shadow-2xl">処理中です</div>
    </div>
}
