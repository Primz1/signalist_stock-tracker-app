import Header from '@/components/layout/Header';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/better-auth/auth';

export const dynamic = 'force-dynamic';

const layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) redirect('/sign-in');

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0A0A0A] text-[#A1A1A1]">
      <Header user={user} />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-6 md:py-7 lg:px-8">
        {children}
      </div>
    </main>
  );
};

export default layout;
