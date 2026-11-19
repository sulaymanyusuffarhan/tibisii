import { NextRequest, NextResponse } from 'next/server';
const LANG_COOKIE_NAME = 'tbc_lang';
function randomHex(bytes = 16) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (value) => value.toString(16).padStart(2, '0')).join('');
}
function createNonce() {
  const data = new Uint8Array(16);
  crypto.getRandomValues(data);
  return btoa(String.fromCharCode(...data));
}
function securityPolicy(nonce: string) {
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}
export function middleware(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  const requestId = randomHex();
  const pathLang = request.nextUrl.pathname.split('/')[1];
  const storedLang = request.cookies.get(LANG_COOKIE_NAME)?.value;
  const lang = pathLang === 'sw' || pathLang === 'en' ? pathLang : storedLang === 'en' ? 'en' : 'sw';
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const isHttps = forwardedProto === 'https' || request.nextUrl.protocol === 'https:';
  const policy = securityPolicy(nonce);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-locale', lang);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  if (process.env.NODE_ENV === 'production' && isHttps) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (pathLang === 'sw' || pathLang === 'en') {
    response.cookies.set(LANG_COOKIE_NAME, pathLang, {
      path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true,
      secure: isHttps,
    });
  }
  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/api/admin')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'] };
