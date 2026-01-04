UPDATE public.accounts
SET role = 'admin'
WHERE email ILIKE '%@veemahpay.com'
  AND (role IS NULL OR role <> 'admin');

