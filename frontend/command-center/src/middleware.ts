import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Handle keokarpin-3d.spinach.ai subdomain
  if (hostname.startsWith('keokarpin-3d.')) {
    url.pathname = '/keokarpin-3d';
    return NextResponse.rewrite(url);
  }

  // Handle spinach.ai root domain
  if (hostname === 'spinach.ai' || hostname === 'www.spinach.ai') {
    // Let normal routing handle the root
    return NextResponse.next();
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