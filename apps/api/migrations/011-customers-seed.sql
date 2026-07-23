SET session_replication_role = 'replica';

INSERT INTO "customers" ("id", "customer_id", "user_id", "zone_id", "address", "area", "city", "pincode", "latitude", "longitude", "delivery_preference", "preferred_delivery_time", "is_active", "created_at", "created_by", "updated_at", "updated_by", "deleted_at", "deleted_by") VALUES
(1, 'CUSTE5J40MNVPCJ23J1A', 'USRCUST23SP4TUL3Z182', 'ZONEOSV8GSB39FD82JWE', 'enc::d72b17bb3dbe811beb314a55990fb9d8:4cddb7ba410ce8bb8e5db2c7bccbe795:7db9e0e3b6852a81149921a3cc031bdd60aa0a1ffb3dc2ffcf43c787a0214c1740f2a0682dd0', 'enc::567b1abd39122204adeda2a443efc188:7d2e7099002e9861a1be92aa75e9b679:304d00b1a2ce3ff666221f5a17176cc3', 'enc::b46473bfa6750c4935ceb1a33085195c:7f7fe1c4aa083aa39cf954ddb776e91a:2ea891b241673a22d9', 'enc::f2257f5a580125dd61bb156c04de4b8d:637d2a3ba60660ec900fbfc5b4d7218f:114ae6f2abe2', NULL, NULL, 'morning', NULL, 1, '2026-04-16 15:02:40', NULL, '2026-04-16 15:04:22', NULL, NULL, NULL);

SET session_replication_role = 'origin';
