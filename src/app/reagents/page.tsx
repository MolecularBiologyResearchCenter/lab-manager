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
        <div className="content-wrapper app-page">
            <div className="app-page-header">
                <div>
                    <h1 className="app-page-title">有料サービス記録</h1>
                    <p className="app-page-description">使用したサービスと数量を入力</p>
                </div>
            </div>
            <ReagentLogger reagents={reagents} currentUser={currentUser} />
        </div>
    )
}
