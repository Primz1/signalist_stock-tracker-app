import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/** Public: marketing home + auth. Everything else requires a session. */
const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isPublic = PUBLIC_PATHS.some((p) =>
    p === '/' ? pathname === '/' : pathname.startsWith(p)
  );

  // Logged-in users skip marketing / auth → app dashboard
  if (sessionCookie && (pathname === '/' || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isPublic) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
};
