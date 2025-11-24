import { getReagentList, getCurrentUser } from '@/app/actions'
import ReagentLogger from '@/components/ReagentLogger'
import { redirect } from 'next/navigation'

export default async function ReagentsPage() {
    const reagents = await getReagentList()
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        redirect('/login')
    }

    return (
        <div className="content-wrapper py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">有料サービス記録</h1>
                <p className="text-gray-600 mt-1">有料サービスの使用量を記録</p>
            </div>
            <ReagentLogger reagents={reagents} currentUser={currentUser} />
        </div>
    )
}
