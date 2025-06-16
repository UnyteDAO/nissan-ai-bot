import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic認証の認証情報
const BASIC_AUTH_USER = 'dao-admin';
const BASIC_AUTH_PASSWORD = 'contribution2024';

export function middleware(request: NextRequest) {
  // Basic認証のヘッダーを取得
  const basicAuth = request.headers.get('authorization');
  const url = request.nextUrl;

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user === BASIC_AUTH_USER && pwd === BASIC_AUTH_PASSWORD) {
      return NextResponse.next();
    }
  }

  // 認証が失敗した場合は401を返す
  url.pathname = '/api/auth';
  return NextResponse.rewrite(url);
}

// 全てのルートに適用（静的ファイルとAPIルートを除く）
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};