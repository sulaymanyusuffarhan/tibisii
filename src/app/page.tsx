import { redirect } from 'next/navigation';
import { getActiveLang } from '@/lib/i18n';

export default async function HomePage() {
  redirect(`/${await getActiveLang()}`);
}
