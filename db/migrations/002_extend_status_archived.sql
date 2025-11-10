-- Migration: support Archived status for accounts
-- Alters status column length and constraint to include 'Archived'.

ALTER TABLE public.accounts
  ALTER COLUMN status TYPE VARCHAR(10);

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS status_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT status_check CHECK (status IN ('Active','Locked','Archived'));