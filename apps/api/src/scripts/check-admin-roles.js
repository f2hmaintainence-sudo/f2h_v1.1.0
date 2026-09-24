const { Client } = require('pg');

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 5432,
  database: 'f2h_dev',
  user: 'f2h_user',
  password: 'f2h_password',
};

async function main() {
  const pg = new Client(DB_CONFIG);
  await pg.connect();

  console.log('=== ADMIN / STAFF USERS IN DB ===');
  const adminUsers = await pg.query(
    `SELECT u.user_id, u.user_name, u.email, u.phone, u.role_id, u.account_status, ms.management_id, ms.is_active
     FROM users u
     LEFT JOIN management_staff ms ON ms.user_id = u.user_id
     WHERE u.role_id IN ('SUPER_ADMIN', 'ADMIN', 'admin', 'super_admin', 'staff', 'STORE_MANAGER')
        OR ms.management_id IS NOT NULL
     LIMIT 10`
  );
  console.log(adminUsers.rows);

  console.log('\n=== ROLES IN DB ===');
  const roles = await pg.query(
    `SELECT * FROM admin_roles LIMIT 10`
  ).catch(async () => {
    return await pg.query(`SELECT * FROM roles LIMIT 10`).catch(() => ({ rows: [] }));
  });
  console.log(roles.rows);

  console.log('\n=== ROLE PERMISSIONS COUNT ===');
  const rolePerms = await pg.query(
    `SELECT role_id, count(*) as perms_count FROM role_permissions GROUP BY role_id`
  ).catch(() => ({ rows: [] }));
  console.log(rolePerms.rows);

  await pg.end();
}

main().catch(console.error);
