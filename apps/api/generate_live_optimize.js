const fs = require('fs');

const schemaPath = '/root/.gemini/antigravity-ide/brain/2866cb26-c48e-4429-a392-6bb7ed04ec21/scratch/live_schema.json';
const targetDocPath = '/home/f2hfresh/htdocs/f2hfresh.com/optimize.md';

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

function formatSqlType(col) {
  let t = col.type.toUpperCase();
  if (t === 'CHARACTER VARYING') {
    return col.max_len ? `VARCHAR(${col.max_len})` : 'VARCHAR';
  }
  if (t === 'TIMESTAMP WITH TIME ZONE') return 'TIMESTAMPTZ';
  if (t === 'TIMESTAMP WITHOUT TIME ZONE') return 'TIMESTAMP';
  if (t === 'USER-DEFINED') return 'VARCHAR(50)';
  if (t === 'DOUBLE PRECISION') return 'DOUBLE PRECISION';
  if (t === 'SMALLINT') return 'SMALLINT';
  if (t === 'BIGINT') return 'BIGINT';
  if (t === 'INTEGER') return 'INT';
  if (t === 'BOOLEAN') return 'BOOLEAN';
  if (t === 'NUMERIC') return 'NUMERIC(12,2)';
  if (t === 'TEXT') return 'TEXT';
  if (t === 'JSONB') return 'JSONB';
  if (t === 'DATE') return 'DATE';
  if (t === 'UUID') return 'UUID';
  return t;
}

const auditColNames = ['created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at', 'delete_on', 'restored_at'];

function getColumnPriorityGroup(colName) {
  if (auditColNames.includes(colName)) return 'Priority 6: Audit Timestamps';
  if (colName === 'id' || colName.endsWith('_id')) return 'Priority 1: Primary Key / Foreign Key';
  if (['phone', 'email', 'password', 'password_hash', 'user_name', 'sku', 'code'].includes(colName)) return 'Priority 2: Credentials & Identifiers';
  if (['first_name', 'last_name', 'name', 'title', 'subject', 'status', 'primary_role', 'account_status', 'is_active', 'is_verified'].includes(colName)) return 'Priority 3: Identity & System State';
  return 'Priority 4: Domain Operations & Metrics';
}

function getPrimaryKeyCol(tableName, cols) {
  const explicitPkName = `${tableName.slice(0, -1)}_id`;
  const directPkName = `${tableName}_id`;

  if (cols.some(c => c.column === directPkName)) return directPkName;
  if (cols.some(c => c.column === explicitPkName)) return explicitPkName;
  if (cols.some(c => c.column === 'id')) return 'id';
  const firstId = cols.find(c => c.column.endsWith('_id'));
  if (firstId) return firstId.column;
  return cols[0].column;
}

function generateCleanTableSection(tableName, cols, index) {
  let out = `### 15.${index + 1} Table: \`${tableName}\` (${cols.length} Live Columns)\n\n`;
  out += `#### A. Live Column Structure Inventory (Direct from \`f2h_fresh\` PostgreSQL)\n\n`;
  out += `| # | Live Column Name | PostgreSQL Data Type | Nullable | Default Value | Priority Group |\n`;
  out += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  cols.forEach((c, i) => {
    const typeStr = c.max_len ? `${c.type}(${c.max_len})` : c.type;
    const defaultStr = c.default ? `\`${c.default.replace(/\n/g, ' ')}\`` : '-';
    const group = getColumnPriorityGroup(c.column);
    out += `| ${i + 1} | \`${c.column}\` | \`${typeStr}\` | ${c.nullable} | ${defaultStr} | ${group} |\n`;
  });

  out += `\n#### B. Clean & Optimized PostgreSQL DDL Blueprint\n\n`;
  out += `\`\`\`sql\nCREATE TABLE ${tableName} (\n`;

  const primaryKeyCol = getPrimaryKeyCol(tableName, cols);

  // Separate non-audit and audit columns
  const nonAuditCols = cols.filter(c => !auditColNames.includes(c.column));
  const liveAuditCols = cols.filter(c => auditColNames.includes(c.column));

  const priorityRank = {
    'Priority 1: Primary Key / Foreign Key': 1,
    'Priority 2: Credentials & Identifiers': 2,
    'Priority 3: Identity & System State': 3,
    'Priority 4: Domain Operations & Metrics': 4,
  };

  const sortedNonAudit = [...nonAuditCols].sort((a, b) => {
    let rA = priorityRank[getColumnPriorityGroup(a.column)] || 4;
    let rB = priorityRank[getColumnPriorityGroup(b.column)] || 4;
    if (a.column === primaryKeyCol) rA = 0;
    if (b.column === primaryKeyCol) rB = 0;
    return rA - rB;
  });

  // Ensure created_at, updated_at, deleted_at are present at the end of DDL
  const hasCreatedBy = liveAuditCols.find(c => c.column === 'created_by');
  const hasUpdatedBy = liveAuditCols.find(c => c.column === 'updated_by');
  const hasCreatedAt = liveAuditCols.find(c => c.column === 'created_at');
  const hasUpdatedAt = liveAuditCols.find(c => c.column === 'updated_at');
  const hasDeletedAt = liveAuditCols.find(c => c.column === 'deleted_at');

  const finalAuditCols = [];
  if (hasCreatedBy) finalAuditCols.push(hasCreatedBy);
  if (hasUpdatedBy) finalAuditCols.push(hasUpdatedBy);
  
  finalAuditCols.push(hasCreatedAt || { column: 'created_at', type: 'timestamp with time zone', nullable: 'YES', default: 'NOW()', max_len: null });
  finalAuditCols.push(hasUpdatedAt || { column: 'updated_at', type: 'timestamp with time zone', nullable: 'YES', default: 'NOW()', max_len: null });
  finalAuditCols.push(hasDeletedAt || { column: 'deleted_at', type: 'timestamp with time zone', nullable: 'YES', default: null, max_len: null });

  // Any remaining extra audit columns like delete_on, restored_at
  liveAuditCols.forEach(c => {
    if (!['created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at'].includes(c.column)) {
      finalAuditCols.push(c);
    }
  });

  const allOrderedCols = [...sortedNonAudit, ...finalAuditCols];

  const ddlLines = allOrderedCols.map(c => {
    let colName = c.column;
    let type = formatSqlType(c);
    let nullability = c.nullable === 'NO' ? ' NOT NULL' : '';
    let def = '';

    if (c.default) {
      let d = c.default;
      if (d.includes('nextval')) {
        if (type === 'BIGINT') type = 'BIGSERIAL';
        else if (type === 'INT') type = 'SERIAL';
      } else {
        def = ` DEFAULT ${d.split('::')[0]}`;
      }
    } else if (['created_at', 'updated_at'].includes(colName) && !c.default) {
      def = ' DEFAULT NOW()';
    }

    let pkStr = (colName === primaryKeyCol) ? ' PRIMARY KEY' : '';
    return `    ${colName} ${type}${pkStr}${nullability}${def}`;
  });

  out += ddlLines.join(',\n');
  out += `\n);\n\`\`\`\n\n---\n\n`;
  return out;
}

function updateOptimizeDoc() {
  let existingContent = fs.readFileSync(targetDocPath, 'utf8');

  const sec15Idx = existingContent.indexOf('# SECTION 15:');
  if (sec15Idx !== -1) {
    existingContent = existingContent.substring(0, sec15Idx);
  }

  let sec15 = `# SECTION 15: COMPLETE 85 LIVE DATABASE TABLES STRUCTURE & OPTIMIZED DDL INVENTORY\n\n`;
  sec15 += `This section contains the **complete, un-truncated live structure** for all **85 PostgreSQL tables** queried directly from the live database (\`f2h_fresh\`). It includes all manually added columns, live default values, data types, nullability constraints, and the clean 6-Level Column Priority Sorted DDL for each table.\n\n`;
  sec15 += `> [!IMPORTANT]\n> Every single table DDL blueprint ends strictly with standard audit timestamps: \`created_at\`, \`updated_at\`, and \`deleted_at\` at the end of the structure.\n\n`;

  const tableNames = Object.keys(schema).sort();
  tableNames.forEach((tableName, index) => {
    sec15 += generateCleanTableSection(tableName, schema[tableName], index);
  });

  const finalContent = existingContent.trim() + '\n\n' + sec15;
  fs.writeFileSync(targetDocPath, finalContent, 'utf8');
  console.log('Successfully updated optimize.md with refined Section 15! Total lines:', finalContent.split('\n').length);
}

updateOptimizeDoc();
