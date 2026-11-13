// Tipe data dan konstanta bersama untuk fitur Split Bill.

export interface SplitGroup {
  id: string; user_id: string; name: string; emoji: string; created_at: string;
  /** 'event' = Split Bill sekali selesai (bawaan), 'running' = buku Gantian yang berjalan terus. Kosong bila SQL 05 belum dijalankan. */
  kind?: 'event' | 'running';
}

export interface SplitMember {
  id: string;
  group_id: string;
  name: string;
  is_me: boolean;
  user_id: string | null;           // terisi bila teman ini pengguna Celengin (diundang)
  status: 'accepted' | 'pending';   // pending = undangan belum diterima
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  phone?: string | null;            // nomor WhatsApp (opsional, butuh sql/05_gantian.sql)
}

export interface SplitItemRow {
  id: string;
  expense_id: string;
  name: string;
  price: number | string;           // harga satuan
  qty: number;
  position: number;
  split_item_assignees?: { member_id: string }[];
}

export interface SplitExpense {
  id: string;
  group_id: string;
  title: string;
  total_amount: number | string;
  paid_by: string;
  created_by: string | null;
  expense_date: string;
  split_type: 'equal' | 'custom' | 'items';
  subtotal: number | string | null;
  discount_amount: number | string | null;
  service_amount: number | string | null;
  tax_amount: number | string | null;
  created_at: string;
  split_shares?: { member_id: string; share_amount: number | string }[];
  split_expense_items?: SplitItemRow[];
}

export interface SplitSettlement {
  id: string;
  group_id: string;
  from_member: string;
  to_member: string;
  amount: number | string;
  created_at: string;
}

export const BANKS = [
  'BCA', 'Mandiri', 'BRI', 'BNI', 'BSI', 'BTN', 'CIMB Niaga', 'Permata',
  'Danamon', 'OCBC', 'Panin', 'Maybank', 'UOB', 'BJB', 'DKI', 'Jago',
  'SeaBank', 'Blu by BCA', 'Jenius', 'OVO', 'GoPay', 'DANA', 'ShopeePay', 'Lainnya',
];
