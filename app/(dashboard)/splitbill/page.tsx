'use client';
import SplitBoard from '@/components/SplitBoard';

// Split Bill (patungan sekali selesai). Seluruh logikanya ada di components/SplitBoard.tsx,
// dipakai bersama menu Gantian (/gantian).
export default function SplitBillPage() {
  return <SplitBoard kind="event" />;
}
