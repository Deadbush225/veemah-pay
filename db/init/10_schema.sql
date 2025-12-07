-- Schema initialization copied from db/schema.sql

CREATE TABLE IF NOT EXISTS accounts (
  account_number VARCHAR(10) PRIMARY KEY,
  name           VARCHAR(100)    NOT NULL,
  email          VARCHAR(255)    UNIQUE NOT NULL,
  balance        NUMERIC(12,2)   NOT NULL DEFAULT 0,
  pin            VARCHAR(4)      NOT NULL,
  status         VARCHAR(10)     NOT NULL,
  failed_attempts INTEGER        NOT NULL DEFAULT 0,
  CONSTRAINT status_check CHECK (status IN ('Active','Locked','Archived')),
  CONSTRAINT pin_format_check CHECK (pin ~ '^[0-9]{4}$')
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  account_number VARCHAR(10) NOT NULL REFERENCES accounts(account_number) ON DELETE CASCADE, -- source account
  target_account VARCHAR(10) REFERENCES accounts(account_number) ON DELETE RESTRICT,
  type VARCHAR(10) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Completed',
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  source_balance_before NUMERIC(12,2),
  source_balance_after  NUMERIC(12,2),
  target_balance_before NUMERIC(12,2),
  target_balance_after  NUMERIC(12,2),
  CONSTRAINT type_check CHECK (type IN ('deposit','withdraw','transfer','fee')),
  CONSTRAINT status_tx_check CHECK (status IN ('Pending','Completed','Voided'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(account_number);
CREATE INDEX IF NOT EXISTS idx_transactions_target ON transactions(target_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE TABLE IF NOT EXISTS transaction_audit (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  action VARCHAR(12) NOT NULL,
  performed_by VARCHAR(10) NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT action_check CHECK (action IN ('create','update','complete','void','rollback'))
);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  email VARCHAR(255) NOT NULL PRIMARY KEY,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
