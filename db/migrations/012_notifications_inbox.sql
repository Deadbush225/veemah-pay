CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD','READ')),
  recipient_account_number TEXT NOT NULL REFERENCES public.accounts(account_number) ON DELETE CASCADE,
  sender_account_number TEXT REFERENCES public.accounts(account_number) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'account_number'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'recipient_account_number'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN account_number TO recipient_account_number;
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_account_number TEXT,
  ADD COLUMN IF NOT EXISTS sender_account_number TEXT REFERENCES public.accounts(account_number) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_recipient_account_number_fkey
      FOREIGN KEY (recipient_account_number) REFERENCES public.accounts(account_number) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE invalid_count int;
BEGIN
  SELECT COUNT(*)::int INTO invalid_count
  FROM public.notifications
  WHERE type IS NOT NULL AND type NOT IN ('MESSAGE','ALERT','TRANSACTION','SYSTEM','SECURITY','INFO');

  IF invalid_count = 0 THEN
    BEGIN
      ALTER TABLE public.notifications
        ADD CONSTRAINT notifications_type_check
          CHECK (type IN ('MESSAGE','ALERT','TRANSACTION','SYSTEM','SECURITY','INFO'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE recipient_account_number IS NULL) THEN
    ALTER TABLE public.notifications ALTER COLUMN recipient_account_number SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_account ON public.notifications(recipient_account_number);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
