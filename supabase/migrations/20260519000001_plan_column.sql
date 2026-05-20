-- Add plan column to profiles for Dodo Payments lifetime upgrade
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_purchased_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dodo_payment_id TEXT;
