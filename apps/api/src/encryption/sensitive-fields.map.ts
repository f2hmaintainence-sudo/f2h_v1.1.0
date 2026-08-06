/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  SENSITIVE FIELDS MAP                                                     ║
 * ║  Defines which table columns contain PII / sensitive data and must be     ║
 * ║  encrypted at rest using AES-256-GCM field-level encryption.              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 *  ┌─────────────────────┬──────────────────────────┬────────────────────────┐
 *  │ Table               │ Column                   │ Data Type              │
 *  ├─────────────────────┼──────────────────────────┼────────────────────────┤
 *  │ users               │ email                    │ TEXT                   │
 *  │ users               │ phone                    │ TEXT                   │
 *  │ users               │ first_name               │ TEXT                   │
 *  │ users               │ last_name                │ TEXT                   │
 *  │ user_info           │ phone                    │ TEXT                   │
 *  │ user_info           │ alt_phone                │ TEXT                   │
 *  │ user_info           │ alt_email                │ TEXT                   │
 *  │ user_info           │ address                  │ TEXT                   │
 *  │ user_info           │ postal_code              │ TEXT                   │
 *  │ user_info           │ date_of_birth            │ TEXT                   │
 *  │ user_info           │ nationality              │ TEXT                   │
 *  │ customers           │ address                  │ TEXT                   │
 *  │ customers           │ area                     │ TEXT                   │
 *  │ customers           │ city                     │ TEXT                   │
 *  │ customers           │ pincode                  │ TEXT                   │
 *  │ delivery_partners       │ name                     │ TEXT                   │
 *  │ delivery_partners       │ email                    │ TEXT                   │
 *  │ delivery_partners       │ phone                    │ TEXT                   │
 *  │ delivery_partners       │ license_plate            │ TEXT                   │
 *  │ delivery_partners       │ initial_password         │ TEXT                   │
 *  │ user_devices        │ ip_address               │ TEXT                   │
 *  └─────────────────────┴──────────────────────────┴────────────────────────┘
 */

export interface SensitiveFieldEntry {
  table: string;
  columns: string[];
}

/**
 * Map of table name → array of sensitive column names.
 * Used by FieldEncryptionService to auto-encrypt on insert/update
 * and auto-decrypt on select.
 */
export const SENSITIVE_FIELDS_MAP: Record<string, string[]> = {
  users: [],
  user_info: [
    'phone',
    'alt_phone',
    'alt_email',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'postal_code',
    'country',
    'date_of_birth',
    'nationality',
  ],
  customers: ['address', 'area', 'city', 'pincode'],
  delivery_partners: [],
  user_devices: ['ip_address'],
};

/**
 * Flat list for quick lookups: "table.column"
 */
export const SENSITIVE_FIELD_SET: Set<string> = new Set(
  Object.entries(SENSITIVE_FIELDS_MAP).flatMap(([table, cols]) =>
    cols.map((col) => `${table}.${col}`),
  ),
);

/**
 * Get sensitive columns for a given table, or empty array if none.
 */
export function getSensitiveColumns(table: string): string[] {
  return SENSITIVE_FIELDS_MAP[table] ?? [];
}

/**
 * Check if a specific table.column is sensitive.
 */
export function isSensitiveField(table: string, column: string): boolean {
  return SENSITIVE_FIELD_SET.has(`${table}.${column}`);
}
