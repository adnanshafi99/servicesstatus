import { redirect } from 'next/navigation';

// Hide /status page by redirecting to home
export default function StatusPage() {
  redirect('/');
}
