-- Migration: extend transactions ledger and add audit trail

-- Add new columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS target_account VARCHAR(5) REFERENCES public.accounts(account_number) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'Completed',
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(5) NOT NULL DEFAULT '0000',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_balance_before NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS source_balance_after  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_balance_before NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_balance_after  NUMERIC(12,2);

-- Normalize existing type values to lowercase
UPDATE public.transactions SET type = LOWER(type) WHERE type IS NOT NULL;

-- Add constraints and indexes
DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT type_check CHECK (type IN ('deposit','withdraw','transfer','fee'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT status_tx_check CHECK (status IN ('Pending','Completed','Voided'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions(account_number);
CREATE INDEX IF NOT EXISTS idx_transactions_target ON public.transactions(target_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

-- Create audit trail table
CREATE TABLE IF NOT EXISTS public.transaction_audit (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  action VARCHAR(12) NOT NULL,
  performed_by VARCHAR(5) NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT action_check CHECK (action IN ('create','update','complete','void','rollback'))
);