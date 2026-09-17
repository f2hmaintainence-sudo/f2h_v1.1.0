-- 026-management-staff-profile-columns.sql
--
-- Ensures all profile and extension columns exist on management_staff, users, customers, and delivery_partners.

BEGIN;

-- 1. Management Staff extension columns
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS gender         character varying(20);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS date_of_birth  date;
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS marital_status character varying(30);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS bio            text;
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS education      character varying(100);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS address_line1  character varying(100);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS address_line2  character varying(100);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS city           character varying(50);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS state          character varying(50);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS postal_code    character varying(20);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS alt_phone      character varying(20);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS department     character varying(100);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS designation    character varying(100);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS branch_id     character varying(30);
ALTER TABLE public.management_staff ADD COLUMN IF NOT EXISTS is_active      boolean DEFAULT true;

-- 2. Users table fallback columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender        character varying(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth date;

-- 3. Customers table columns
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender           character varying(20);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS dob              date;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS alternate_mobile character varying(20);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS alternate_phone  character varying(20);

-- 4. Delivery partners table columns
ALTER TABLE public.delivery_partners ADD COLUMN IF NOT EXISTS gender        character varying(20);
ALTER TABLE public.delivery_partners ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMIT;
