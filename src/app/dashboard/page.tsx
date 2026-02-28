import { redirect } from 'next/navigation';

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default async function Dashboard() {
  if (CLERK_ENABLED) {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (!userId) {
      return redirect('/auth/sign-in');
    }
  }

  redirect('/dashboard/overview');
}
