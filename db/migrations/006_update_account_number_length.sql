-- Increase account number length from 5 to 10 digits

-- Update accounts table
ALTER TABLE accounts ALTER COLUMN account_number TYPE VARCHAR(10);

-- Update transactions table
ALTER TABLE transactions ALTER COLUMN account_number TYPE VARCHAR(10);
ALTER TABLE transactions ALTER COLUMN target_account TYPE VARCHAR(10);
ALTER TABLE transactions ALTER COLUMN created_by TYPE VARCHAR(10);

-- Update transaction_audit table
ALTER TABLE transaction_audit ALTER COLUMN performed_by TYPE VARCHAR(10);
