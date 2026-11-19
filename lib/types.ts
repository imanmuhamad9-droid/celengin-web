// Bentuk baris tabel Supabase yang dipakai di UI. Kolom opsional (?) = tidak selalu dipilih / bergantung migrasi SQL.
// Kolom numeric dari PostgREST berupa number; kode yang ragu tetap membungkusnya dengan Number(...).

export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  user_id: string;
  merchant_name: string;
  amount: number;
  type: TxType;
  transaction_date: string; // YYYY-MM-DD
  created_at?: string;
  is_routine?: boolean;
  is_ai_scanned?: boolean;
  recurring_rule_id?: string | null;
  wallet_id?: string | null;
  notes?: string | null;
}

export interface Preset {
  id: string;
  user_id?: string;
  label: string;
  emoji?: string | null;
  created_at?: string;
}

export interface Target {
  id: string;
  user_id: string;
  period_type: string;
  start_date: string;
  end_date: string;
  target_income: number;
  target_expense: number;
  is_primary: boolean;
  created_at?: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  merchant_name: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
  due_date: string;
  anchor_day: number;
  remind_days_before: number | null;
  is_active: boolean;
  last_paid_date?: string | null;
  paid_count?: number | null;
  wallet_id?: string | null;
}

export interface DreamGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface CoupleGoal {
  id: string;
  title: string;
  category: 'couple' | 'friend';
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
  created_by: string;
  created_at?: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  merchant_name: string;
  amount: number;
  type: TxType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  anchor_day: number;
  next_run_date: string;
  end_date?: string | null;
  is_active: boolean;
  last_run_date?: string | null;
  wallet_id?: string | null;
}

export interface Profile {
  id: string;
  nickname?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  payday?: number | null;
  payday_shift?: 'none' | 'before' | 'after' | null;
  emergency_months?: number | null;
  // Widget saldo aman di Dashboard
  safe_limit?: number | null;
  bg_safe_url?: string | null;
  bg_low_url?: string | null;
  bg_safe_pos?: string | null;
  bg_low_pos?: string | null;
  bg_safe_zoom?: number | null;
  bg_low_zoom?: number | null;
  theme_color?: string | null;
}

export interface NameProfile { nickname?: string | null; full_name?: string | null }

export interface CoupleMember {
  id: string;
  goal_id?: string;
  user_id: string;
  status: string;
  profiles?: NameProfile | null;
}

export type CoupleGoalView = CoupleGoal & { couple_members: CoupleMember[] };

export type CoupleInvite = CoupleMember & { goal_id: string; couple_goals?: { title: string; created_by: string } | null };

export interface CoupleTx {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  type: string;
  created_at: string;
  profiles?: NameProfile | null;
}

export interface GoalEstimate {
  goal: CoupleGoalView;
  remaining: number;
  n: number;
  surplus: number;
  monthsLeft: number | null;
  today: string;
  dateOver: boolean;
}

export interface GoalTx {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  type: 'in' | 'out';
  created_at: string;
}
