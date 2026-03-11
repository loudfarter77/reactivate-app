// Force all /admin/* pages to be server-rendered on every request.
// Without this, Next.js may pre-render and cache pages at build time,
// causing Supabase data changes to not appear until the next deployment.
export const dynamic = 'force-dynamic'

import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="pl-60">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
