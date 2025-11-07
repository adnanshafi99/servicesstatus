import { cookies } from 'next/headers';

export async function setAuthSession(username: string) {
  const cookieStore = await cookies();
  cookieStore.set('admin_session', username, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getAuthSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return session?.value || null;
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
}


