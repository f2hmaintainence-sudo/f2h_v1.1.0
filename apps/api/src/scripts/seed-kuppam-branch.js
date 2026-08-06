const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://f2h_user:f2h_password@127.0.0.1:5432/f2h_fresh',
  });

  await client.connect();

  const insertSql = `
    INSERT INTO branches (
      branch_id, branch_name, branch_code, city, state, address, is_active,
      lat, lng, delivery_radius_km, buffer_zone, allow_buffer_order, hex_shape, created_at, updated_at
    ) VALUES (
      'BRANCH_KUPPAM_01', 'F2H Kuppam Hub', 'KUP01', 'Kuppam', 'Andhra Pradesh', '1433, Krishnagiri Madanapalle Highway, Vendugampalle, Kuppam', true,
      12.7500, 78.3667, 30.0, 5.0, true, 'circle', NOW(), NOW()
    )
    ON CONFLICT (branch_id) DO UPDATE SET
      is_active = true,
      lat = 12.7500,
      lng = 78.3667,
      delivery_radius_km = 30.0,
      buffer_zone = 5.0,
      allow_buffer_order = true;
  `;

  await client.query(insertSql);
  const result = await client.query('SELECT branch_id, branch_name, lat, lng, delivery_radius_km, is_active FROM branches');
  console.log('ALL_ACTIVE_BRANCHES_IN_DB:', result.rows);
  await client.end();
}

run().catch(console.error);
