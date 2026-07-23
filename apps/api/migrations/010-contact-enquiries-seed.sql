SET session_replication_role = 'replica';

INSERT INTO "contact_enquiries" ("id", "enquiry_id", "full_name", "phone", "product_id", "product_name", "quantity", "unit_type", "address", "address_line1", "city", "state", "pincode", "map_url", "notes", "status", "created_at", "updated_at", "deleted_at") VALUES
(1, 'ENQ233F99D10D37060A', 'Baulin Priyanka ', '9901924242', 'PRODIBYYZ4XT024VEILA', 'Milk 1L', 0.50, 'litre', 'C301  SV Prime ', 'Behind SV Legacy ', 'Bangalore ', 'Karnataka ', '560066', 'https://www.google.com/maps?q=12.9816734,77.7562856', '', 'converted', '2026-04-16 15:01:44', '2026-04-16 15:02:40', NULL);

SET session_replication_role = 'origin';
