-- Migration: Add password and terms_accepted to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
