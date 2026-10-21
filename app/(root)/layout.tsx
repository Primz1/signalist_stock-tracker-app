import Header from '@/components/layout/Header';
import { redirect } from 'next/navigation';
import { getCachedSession } from '@/lib/auth/session';

const layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getCachedSession();

  if (!session?.user) redirect('/sign-in');

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-canvas text-ink-2">
      <Header user={user} />
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 md:px-6 md:pt-8 lg:px-8">
        {children}
      </div>
    </main>
  );
};

export default layout;
