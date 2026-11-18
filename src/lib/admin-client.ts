'use client';

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (!['GET','HEAD','OPTIONS'].includes(method)) {
    const session = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!session.ok) {
      if (typeof window !== 'undefined') window.location.assign('/admin/login');
      throw new Error('Your session has expired. Sign in again.');
    }
    const { csrfToken } = await session.json();
    headers.set('x-csrf-token', csrfToken);
  }
  const response = await fetch(input, { ...init, method, headers, cache: 'no-store' });
  if (response.status === 401 && typeof window !== 'undefined') window.location.assign('/admin/login');
  return response;
}
