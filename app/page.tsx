import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Check if user is an admin
  const adminIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (adminIds.includes(userId)) {
    redirect('/admin')
  }

  redirect('/dashboard')
}
