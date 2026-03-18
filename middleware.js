import { NextResponse } from 'next/server';

const PASSWORD = 'disfur';
const COOKIE = 'dis_auth';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // 인증 페이지 자체는 통과
  if (pathname === '/auth') return NextResponse.next();

  // 쿠키 확인
  const cookie = request.cookies.get(COOKIE);
  if (cookie?.value === PASSWORD) return NextResponse.next();

  // 없으면 인증 페이지로
  const url = request.nextUrl.clone();
  url.pathname = '/auth';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
