import { NextResponse, type NextRequest } from 'next/server';

const TOKEN_KEY = 'auth_token';

export function middleware(request: NextRequest) {
  const token = request.cookies.get(TOKEN_KEY)?.value;
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedPaths = ['/', '/rooms', '/tenants', '/contracts', '/payments', '/calendar', '/notifications', '/tickets'];
  const isProtected = protectedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));

  // Auth routes (redirect to home if already logged in)
  const authPaths = ['/login', '/register'];
  const isAuthPath = authPaths.some(path => pathname === path);

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPath && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
