 ALTER TABLE accounts ALTER COLUMN pin TYPE VARCHAR(5);
 ALTER TABLE accounts DROP CONSTRAINT IF EXISTS pin_format_check;
 ALTER TABLE accounts ADD CONSTRAINT pin_format_check CHECK (pin ~ '^[0-9]{4,5}$');
