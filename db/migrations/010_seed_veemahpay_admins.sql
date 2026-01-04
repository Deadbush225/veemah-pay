-- Seed VeemahPay admin accounts
-- Requires accounts table with columns: account_number, name, email, balance, pin, status,
-- failed_attempts, password, terms_accepted, role

INSERT INTO public.accounts (account_number, name, email, balance, pin, status, failed_attempts, password, terms_accepted, role) VALUES
  ('0000',        'Administrator',            NULL,     0.00, '0000', 'Active', 0, NULL, TRUE, 'admin'),
  ('9000000001',  'Eliazar Inso',             'eliazarinso@veemahpay.com',        0.00, '0000', 'Active', 0, '$2b$10$4hiVo9VwHf/GdzQOgzx.buzQ9xINk5VOIRj1tJ5lH4OOhLLN7/0di', TRUE, 'admin'),
  ('9000000002',  'Hanzlei Jamison',          'hanzleijamison@veemahpay.com',     0.00, '0000', 'Active', 0, '$2b$10$/kuksvgr49pccDQiHun9Fe1F86ZgOs4KVtB8B6pw7Ru9B4zLGIZ/G', TRUE, 'admin'),
  ('9000000003',  'Adriel Magalona',          'adrielmagalona@veemahpay.com',     0.00, '0000', 'Active', 0, '$2b$10$edveiO1IHCgOR.zhPr/UUOVcl954LmjMebqycFCFJVfIuU9u5nAKe', TRUE, 'admin'),
  ('9000000004',  'Mariel Oliveros',          'marieloliveros@veemahpay.com',     0.00, '0000', 'Active', 0, '$2b$10$/PkvP2sZg8VK.9.GUmFObO8EkGFYnoG4lR6liWir79U6Mbx9mKgHO', TRUE, 'admin'),
  ('9000000005',  'Mark Elijah Sevilla',      'markelijahsevilla@veemahpay.com',  0.00, '0000', 'Active', 0, '$2b$10$wHomAu7piWLq5rfwW6t1UOYN6MM8GYjbG4EZXRvh8kCExNCu0QhfS', TRUE, 'admin'),
  ('9000000006',  'Jan Earl Rodriguez',       'janearlrodriguez@veemahpay.com',   0.00, '0000', 'Active', 0, '$2b$10$Sfsw7IzIpDBoqTYcpoHuuujUIscvW0pCTvhD6VfwPyYYVbWSZ4/j6', TRUE, 'admin'),
  ('9000000007',  'Jude Vincent Puti',        'judevincentputi@veemahpay.com',    0.00, '0000', 'Active', 0, '$2b$10$FiD5RjxJkh4fb21m8Q0z9.TptKKrfpATLOtBU3OKGp5u6siWQgWXm', TRUE, 'admin')
ON CONFLICT (account_number) DO NOTHING;

