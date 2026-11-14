'use client';
import SplitBoard from '@/components/SplitBoard';

// Gantian: buku catatan bayar-gantian yang berjalan terus (saldo bergulir, bayar kapan saja).
export default function GantianPage() {
  return <SplitBoard kind="running" />;
}
