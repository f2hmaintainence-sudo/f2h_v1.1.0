-- Migration: Rename delivery_boys to delivery_partners and update referencing columns
-- Date: 2026-07-17

-- 1. Rename tables
ALTER TABLE delivery_boys RENAME TO delivery_partners;
ALTER TABLE delivery_boy_attendance RENAME TO delivery_partner_attendance;
ALTER TABLE delivery_boy_locations RENAME TO delivery_partner_locations;
ALTER TABLE delivery_boy_salaries RENAME TO delivery_partner_salaries;

-- 2. Rename columns in the main tables
ALTER TABLE delivery_partners RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_partner_attendance RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_partner_locations RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_partner_salaries RENAME COLUMN delivery_boy_id TO delivery_partner_id;

-- 3. Rename columns in other referencing tables
ALTER TABLE branch_sectors RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_assignments RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_attempts RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_leave_requests RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_location_logs RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_logs RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_routes RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_runs RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE delivery_sessions RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE dispatch_balances RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE dispatch_requirements RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE notifications RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE orders RENAME COLUMN delivery_boy_id TO delivery_partner_id;
ALTER TABLE route_daily_overrides RENAME COLUMN assigned_delivery_boy_id TO assigned_delivery_partner_id;

ALTER TABLE delivery_proof_logs RENAME COLUMN delivery_boy_lat TO delivery_partner_lat;
ALTER TABLE delivery_proof_logs RENAME COLUMN delivery_boy_lng TO delivery_partner_lng;

-- 4. Update roles in system lookup tables
UPDATE roles SET role_id = 'DELIVERY_PARTNER', name = 'Delivery Partner' WHERE role_id = 'DELIVERY_BOY';
UPDATE role_assignments SET role_id = 'DELIVERY_PARTNER' WHERE role_id = 'DELIVERY_BOY';
UPDATE users SET role_id = 'DELIVERY_PARTNER' WHERE role_id = 'DELIVERY_BOY';
