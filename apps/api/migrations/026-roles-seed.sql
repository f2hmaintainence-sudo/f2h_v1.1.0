SET session_replication_role = 'replica';

INSERT INTO "roles" ("id", "sno", "role_id", "name", "description", "parent_role_id", "is_system_role", "is_active", "created_by", "updated_by", "delete_on", "restored_at", "deleted_at", "created_at", "updated_at") VALUES
(1, '12', 'ADMIN', 'Admin', NULL, 'ADMIN', 1, 1, NULL, 'USRSDI3FDRET', NULL, NULL, NULL, NULL, '2026-03-30 05:15:12'),
(4, '4', 'DELIVERY_PARTNER', 'Delivery Boy', NULL, 'ADMIN', 1, 1, NULL, 'USRKKINGROKXORL', NULL, NULL, NULL, '2025-12-05 16:21:47', '2026-03-30 04:15:18'),
(5, '3', 'CUSTOMER', 'Customer', NULL, 'ADMIN', 1, 1, NULL, 'U6QLCJZHGAWAYDR', NULL, NULL, NULL, '2025-10-18 05:55:25', '2026-03-30 04:15:23');

SET session_replication_role = 'origin';
