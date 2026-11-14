import { redirect } from 'next/navigation';

// Menu Dompet sudah dihapus. Alamat lama diarahkan ke Home supaya tautan atau bookmark lama tidak error.
export default function WalletsPage() {
  redirect('/dashboard');
}
