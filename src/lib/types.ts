export type TxType = 'income' | 'expense'
export type PaymentMode = 'cash' | 'upi' | 'card'

export interface Category {
  id: string
  user_id: string
  name: string
  type: TxType
  parent_id: string | null
  icon: string | null
  color: string
  is_business: boolean
  created_at: string
  archived: boolean
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string
  amount: number
  type: TxType
  date: string
  notes: string | null
  payment_mode: PaymentMode | null
  is_business: boolean
  preset_id: string | null
  receipt_url: string | null
  created_at: string
}

export interface QuickAddPreset {
  id: string
  user_id: string
  category_id: string
  amount: number
  label: string
  type: TxType
  is_business: boolean
  use_count: number
  last_used_at: string | null
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  monthly_limit: number
  created_at: string
}

export type Scope = 'all' | 'personal' | 'business'
export type Period = 'week' | 'month'
