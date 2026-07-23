/**
 * TableHelper
 *
 * Handles:
 *  1. generateResponse  – builds SQL params, runs 3 queries (data + total + filtered)
 *  2. processData       – maps DB rows → display rows (modify / addon / compute)
 *  3. generateColumnMeta– builds column metadata for DataTables
 *  4. renderView        – template engine (::col::, ::IF::, ::MATH::, ::~Facade->method()~::)
 *  5. evaluateCondition – evaluates IF/ELSEIF conditions on a row
 *  6. evaluateMath      – safe math expressions with column placeholders
 *  7. parseParameters   – splits method-call arguments respecting quotes/nesting
 *  8. handleBase64Data  – returns embeddable HTML for base64 blobs
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataService } from '../shared/database/Data.service';
import { DeveloperService } from '../shared/logger/Developer.service';

// ─── Type Definitions ────────────────────────────────────────────

export interface ColumnDef {
  /** e.g. ['users.email', true]  or  ['users.user_id AS user', true] */
  [key: string]: [string, boolean];
}

export interface JoinDef {
  type: 'left' | 'right' | 'inner' | 'INNER' | 'LEFT' | 'RIGHT';
  table: string;
  on: [string, string][];
}

export interface ConditionDef {
  column: string;
  operator: string;
  value: any;
  boolean?: 'AND' | 'OR';
  nested?: ConditionDef[];
}

export interface CustomDef {
  type: 'modify' | 'addon' | 'compute';
  column: string;
  view?: string;
  renderHtml?: boolean;
  callback?: (row: Record<string, any>) => any;
}

export interface ReqSet {
  key: string;
  table: string;
  token?: string;
  act?: string;
  actions?: string;
  system?: string;
  draw?: number;
  id?: string | null;
  filters?: {
    search?: string | any[];
    dateRange?: Record<string, { from: string; to: string }>;
    columns?: Record<string, any>;
    sort?: Record<string, string>;
    pagination?: { type?: string; page?: number; limit?: number };
  };
  [extra: string]: any;
}

export interface TableSet {
  columns: Record<string, [string, boolean]>;
  joins: JoinDef[];
  conditions: ConditionDef[];
  req_set: ReqSet;
  custom: CustomDef[];
  orderBy?: Record<string, string>;
  groupBy?: string[];
}

export interface TableResponse {
  status: boolean;
  draw: number;
  data: any[];
  columns: any[];
  recordsTotal: number;
  recordsFiltered: number;
  message: string;
}

export interface ColumnMeta {
  data: string;
  name: string;
  title: string;
  orderable: boolean;
  searchable: boolean;
  visible: boolean;
  width: string;
  className: string;
  isDate: boolean;
  renderHtml: boolean;
}

// ─── Action button icon config  ──────

const ACTION_CONFIG: Record<string, { icon: string; suffix: string }> = {
  e: { icon: '<i class="fa fa-edit"></i>', suffix: '_e_' },
  v: { icon: '<i class="fa fa-eye"></i>', suffix: '_v_' },
  d: { icon: '<i class="fa fa-trash"></i>', suffix: '_d_' },
};

// ─── Helpers ─────────────────────────────────────────────────────

/** Convert snake_case to Title Case  (e.g. created_at → Created At) */
function toTitle(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Escape HTML entities for safe attribute/content insertion */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Strip ' AS alias' from a column expression */
function stripAlias(expr: string): string {
  return expr.replace(/\s+AS\s+`?[^`]+`?$/i, '').trim();
}

/** Get the part after the last '.' */
function afterLast(str: string, delimiter: string): string {
  const idx = str.lastIndexOf(delimiter);
  return idx === -1 ? str : str.substring(idx + 1);
}

/** Get the part before the first occurrence */
function beforeFirst(str: string, delimiter: string): string {
  const idx = str.indexOf(delimiter);
  return idx === -1 ? str : str.substring(0, idx);
}

// ─── Injectable Service ──────────────────────────────────────────

@Injectable()
export class TableHelper {
  private readonly logger = new Logger(TableHelper.name);

  constructor(
    private readonly dataService: DataService,
    private readonly Developer: DeveloperService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // 1.  generateResponse
  // ═══════════════════════════════════════════════════════════════

  async generateResponse(
    set: TableSet,
    dataId: string | null = null,
  ): Promise<TableResponse> {
    const reqSet = set.req_set ?? ({} as ReqSet);
    const table = reqSet.table ?? null;
    if (!table) {
      return this.errorResponse('Table not specified in req_set', reqSet);
    }

    // ── Build select + columnMap ────────────────────────────────
    const select: string[] = [];
    const columnMap: Record<string, string> = {};

    for (const [key, col] of Object.entries(set.columns ?? {})) {
      const columnName = Array.isArray(col) && col[0] ? col[0] : String(col);
      select.push(columnName);
      columnMap[key] = stripAlias(columnName);
    }

    // ── Base query params (no filters yet) ─────────────────────
    const params: Record<string, any> = {
      select: select.length ? select : ['*'],
      where: [...(set.conditions ?? [])],
      joins: set.joins ?? [],
      orderBy: set.orderBy ?? null,
      groupBy: set.groupBy ?? null,
    };

    // ── Extract filters from reqSet ────────────────────────────
    const filters = reqSet.filters ?? {};
    const search = filters.search ?? null;
    const columns = filters.columns ?? {};
    const dateRange = filters.dateRange ?? {};
    const sort = filters.sort ?? {};
    const pagination = filters.pagination ?? {
      type: 'offset',
      page: 1,
      limit: 10,
    };

    // ──────────────────────────────────────────────────────────
    // GLOBAL SEARCH  (nested OR group)
    // ──────────────────────────────────────────────────────────
    if (search && typeof search === 'string' && search.trim() !== '') {
      let cleanSearch = search.trim();

      // Reject suspicious patterns
      if (/(-{2}|_{2}|\s{2,})/.test(cleanSearch)) {
        cleanSearch = '';
      } else {
        cleanSearch = cleanSearch.replace(/[^a-zA-Z0-9 .,\-_@]/g, '');
      }

      if (cleanSearch !== '') {
        const searchWhere: any[] = [];

        for (const [, col] of Object.entries(set.columns ?? {})) {
          const columnDef = Array.isArray(col) && col[0] ? col[0] : String(col);
          const column = stripAlias(columnDef);
          if (column) {
            searchWhere.push({
              column,
              operator: 'LIKE',
              value: cleanSearch,
              boolean: 'OR',
            });
          }
        }

        if (searchWhere.length) {
          params.where.push({
            nested: searchWhere,
            boolean: 'AND',
          });
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // COLUMN-BASED FILTERS  (all LIKE)
    // ──────────────────────────────────────────────────────────
    if (columns && typeof columns === 'object') {
      for (const [colName, val] of Object.entries(columns)) {
        if (typeof colName !== 'string') continue;
        if (!/^[a-zA-Z0-9_.]+$/.test(colName)) continue;

        // Resolve display key to actual DB column via columnMap
        const dbColumn = columnMap[colName] ?? colName;

        const values = Array.isArray(val) ? val : [val];
        for (const v of values) {
          let clean = String(v).trim();
          if (/(-{2}|_{2}|\s{2,})/.test(clean)) continue;
          clean = clean.replace(/[^a-zA-Z0-9 .,\-_@]/g, '');
          if (clean !== '') {
            params.where.push({
              column: dbColumn,
              operator: 'LIKE',
              value: clean,
              boolean: 'AND',
            });
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // DATE RANGE FILTERS
    // ──────────────────────────────────────────────────────────
    if (dateRange && typeof dateRange === 'object') {
      for (const [column, range] of Object.entries(dateRange)) {
        if (
          typeof column === 'string' &&
          range &&
          typeof range === 'object' &&
          'from' in range &&
          'to' in range &&
          typeof range.from === 'string' &&
          typeof range.to === 'string'
        ) {
          params.where.push({
            column,
            operator: 'BETWEEN',
            value: [range.from, range.to],
            boolean: 'AND',
          });
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // SORTING
    // ──────────────────────────────────────────────────────────
    if (sort && typeof sort === 'object' && Object.keys(sort).length > 0) {
      // Convert Record<string, string> to OrderByItem[] for applyOrderBy
      const orderByItems: { column: string; direction: string }[] = [];
      for (const [column, direction] of Object.entries(sort)) {
        if (typeof column === 'string' && typeof direction === 'string') {
          let dbCol = columnMap[column] ?? column;
          // Strip any leftover alias
          if (/\s+AS\s+/i.test(dbCol)) {
            dbCol = dbCol.replace(/\s+AS\s+.*/i, '');
          }
          orderByItems.push({
            column: dbCol,
            direction: direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
          });
        }
      }
      params.orderBy = orderByItems;
    }

    // ──────────────────────────────────────────────────────────
    // PAGINATION
    // ──────────────────────────────────────────────────────────
    if (pagination.type === 'offset') {
      params.limit = Number(pagination.limit ?? 10);
      params.offset = (Number(pagination.page ?? 1) - 1) * params.limit;
    }

    // ──────────────────────────────────────────────────────────
    // VALIDATE CONDITIONS (sanity check)
    // ──────────────────────────────────────────────────────────
    for (const condition of params.where) {
      if (condition.nested && Array.isArray(condition.nested)) {
        for (const nc of condition.nested) {
          if (!nc.column || !nc.operator || nc.value === undefined) {
            return this.errorResponse(
              'Invalid nested condition format',
              reqSet,
            );
          }
          if (nc.operator === 'LIKE' && typeof nc.value !== 'string') {
            return this.errorResponse(
              'LIKE operator requires a string value',
              reqSet,
            );
          }
          if (
            ['IN', 'NOT IN'].includes(nc.operator) &&
            !Array.isArray(nc.value)
          ) {
            return this.errorResponse(
              'IN/NOT IN operator requires an array value',
              reqSet,
            );
          }
        }
        continue;
      }
      if (condition.operator && condition.value !== undefined) {
        if (
          ['IN', 'NOT IN'].includes(condition.operator) &&
          !Array.isArray(condition.value)
        ) {
          return this.errorResponse(
            'IN/NOT IN operator requires an array value',
            reqSet,
          );
        }
        if (
          condition.operator === 'LIKE' &&
          typeof condition.value !== 'string'
        ) {
          return this.errorResponse(
            'LIKE operator requires a string value',
            reqSet,
          );
        }
      }
    }

    let conn: any;
    try {
      // ── ACQUIRE SINGLE SHARED CONNECTION ─────────────────────
      // Instead of 3 separate connections (one per query), we reuse one.
      conn = await this.dataService.getSharedConnection();

      // ── MAIN DATA QUERY ──────────────────────────────────────
      const result = await this.dataService.queryWithConnection(
        conn,
        table,
        params,
      );

      // ── PARALLEL COUNT QUERIES (total + filtered) ────────────
      // Run both counts concurrently on the same connection.
      // This cuts wait time from (count1 + count2) to max(count1, count2).
      const totalParams = {
        select: { count: '*' },
        where: [...(set.conditions ?? [])],
        joins: set.joins ?? [],
        orderBy: null, // COUNT queries must NOT have ORDER BY in PostgreSQL
        groupBy: set.groupBy ?? null,
      };

      const filteredParams = { ...params };
      delete filteredParams.limit;
      delete filteredParams.offset;
      filteredParams.select = { count: '*' };
      filteredParams.orderBy = null; // COUNT queries must NOT have ORDER BY in PostgreSQL

      const [totalResult, filteredResult] = await Promise.all([
        this.dataService.queryWithConnection(conn, table, totalParams),
        this.dataService.queryWithConnection(conn, table, filteredParams),
      ]);

      const recordsTotal = totalResult?.data?.[0]?.count ?? 0;
      const recordsFiltered = filteredResult?.data?.[0]?.count ?? 0;

      // ── PROCESS DATA & METADATA ────────────────────────────
      const columnMeta = this.generateColumnMeta(
        set.columns,
        reqSet,
        set.custom ?? [],
      );
      const processedData = this.processData(
        result?.data ?? [],
        set.columns,
        set.custom ?? [],
        reqSet,
        dataId,
      );

      return {
        status: result?.status ?? true,
        draw: Number(reqSet.draw ?? 1),
        data: processedData,
        columns: columnMeta,
        recordsTotal,
        recordsFiltered,
        message:
          result?.query ??
          (processedData.length === 0
            ? 'No records found'
            : 'Records fetched successfully'),
      };
    } catch (err: any) {
      this.Developer.error('TableHelper.generateResponse error', {
        error: err?.message,
      });
      return this.errorResponse(
        'Unexpected error: ' + (err?.message ?? 'Unknown'),
        reqSet,
      );
    } finally {
      // Release the shared connection back to the pool
      conn?.release?.();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2.  processData
  // ═══════════════════════════════════════════════════════════════

  processData(
    data: any[],
    columns: Record<string, [string, boolean]>,
    custom: CustomDef[],
    reqSet: ReqSet,
    dataId: string | null = null,
  ): any[] {
    const validColumns = Object.keys(columns);
    // ── Pre-sort custom definitions ────────────────────────────
    const modifyColumns: Record<string, CustomDef[]> = {};
    const addonColumns: Record<string, CustomDef> = {};
    const computeColumns: Record<string, CustomDef> = {};

    for (const customDef of custom) {
      const type = customDef.type;
      const column = customDef.column;
      if (!type || !column) {
        this.Developer.warn('Invalid custom column definition', {
          custom: customDef,
        });
        continue;
      }
      if (type === 'modify' && validColumns.includes(column)) {
        if (!modifyColumns[column]) modifyColumns[column] = [];
        modifyColumns[column].push(customDef);
      } else if (type === 'addon') {
        addonColumns[column] = customDef;
      } else if (type === 'compute') {
        computeColumns[column] = customDef;
      }
    }

    // ── Action button setup ────────────────────────────────────
    const action = reqSet.actions ?? '';
    const showCheckboxes = action.includes('c');
    const actionButtons: Record<string, { icon: string; suffix: string }> = {};
    for (const [key, config] of Object.entries(ACTION_CONFIG)) {
      if (action.includes(key)) {
        actionButtons[key] = config;
      }
    }
    // Base token: first 4 underscore-separated segments
    const baseToken = (reqSet.token ?? '').replace(
      /^((?:[^_]*_){3}[^_]*)_.*/,
      '$1',
    );
    // ── Map each row ──────────────────────────────────────────
    return data
      .map((row) => {
        if (!row || typeof row !== 'object') {
          return null;
        }

        const mappedRow: Record<string, any> = {};

        for (const [displayName, columnDef] of Object.entries(columns)) {
          if (!Array.isArray(columnDef) || !columnDef[0]) {
            this.Developer.warn('Invalid column definition', {
              displayName,
              columnDef,
            });
            continue;
          }

          let colExpr = columnDef[0].trim();
          let colKey: string;

          // Detect alias: "table.col AS alias"
          if (/\s+AS\s+/i.test(colExpr)) {
            const parts = colExpr.split(/\s+AS\s+/i);
            colExpr = parts[0].trim();
            colKey = parts[1].trim();
          } else {
            colKey = afterLast(colExpr, '.');
          }

          colKey = colKey.replace(/\./g, '_');

          let value = row[colKey] ?? null;

          // Skip hidden columns (visible = false)
          // if (columnDef[1] === false) {
          //   continue;
          // }

          // Apply modify custom
          if (modifyColumns[displayName]) {
            for (const customDef of modifyColumns[displayName]) {
              value = this.renderView(
                customDef.view ?? '',
                row,
                validColumns,
                customDef.renderHtml ?? false,
              );
            }
          }

          // Apply compute callbacks
          // if (computeColumns[displayName]) {
          //   const callback = computeColumns[displayName].callback;
          //   if (typeof callback === 'function') {
          //     try {
          //       value = callback(row);
          //     } catch (e: any) {
          //       this.Developer.warn('Error computing column', {
          //         column: displayName,
          //         error: e?.message,
          //       });
          //       value = null;
          //     }
          //   }
          // }

          if (computeColumns[displayName]) {
            const customDef = computeColumns[displayName];
            const callback = customDef.callback;

            if (typeof callback === 'function') {
              try {
                value = callback(row);

                // IMPORTANT
                if (!customDef.renderHtml && typeof value === 'string') {
                  value = escapeHtml(value);
                }

              } catch (e: any) {
                this.Developer.warn('Error computing column', {
                  column: displayName,
                  error: e?.message,
                });

                value = null;
              }
            }
          }

          mappedRow[displayName] = value ?? '';
        }

        // ── Addon columns ────────────────────────────────────
        for (const [column, customDef] of Object.entries(addonColumns)) {
          mappedRow[column] = this.renderView(
            customDef.view ?? '',
            row,
            validColumns,
            customDef.renderHtml ?? false,
          );
        }

        // ── Checkboxes ───────────────────────────────────────
        if (showCheckboxes) {
          const rowId = String(row[reqSet.act ?? ''] ?? '');

          mappedRow['selection'] =
            `<input type="checkbox" class="row-select skl-checkbox form-check-input" data-id="${escapeHtml(rowId)}">`;
        }

        const dataIdAttr = dataId ? ` data-id=${dataId}` : '';

        // ── Action buttons ───────────────────────────────────
        if (Object.keys(actionButtons).length > 0) {
          let menuItems = '';
          const rowId = row[reqSet.act ?? ''] ?? '';
          for (const [act, config] of Object.entries(actionButtons)) {
            const finalToken = `${baseToken}${config.suffix}${rowId}`;
            menuItems += `<button type="button" class="${escapeHtml(act)} DynamicPopup" data-token="${escapeHtml(finalToken)}">${config.icon}</button>`;
          }
          mappedRow['actions'] =
            `<div class="table-actions-group">${menuItems}</div>`;
        }
        return mappedRow;
      })
      .filter((row): row is Record<string, any> => row !== null);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3.  generateColumnMeta
  // ═══════════════════════════════════════════════════════════════

  generateColumnMeta(
    columns: Record<string, [string, boolean]>,
    reqSet: ReqSet,
    custom: CustomDef[],
  ): ColumnMeta[] {
    const action = reqSet.actions ?? '';
    const showCheckboxes = action.includes('c');
    const showActions =
      action.includes('e') || action.includes('v') || action.includes('d');

    const htmlColumns = custom.filter(
      (c) =>
        (c.type === 'addon' || c.type === 'modify' || c.type === 'compute') &&
        (c.renderHtml ?? false),
    );
    const addonColumns = custom.filter((c) => c.type === 'addon');

    const meta: ColumnMeta[] = [];

    // ── Checkbox column ──────────────────────────────────────
    if (showCheckboxes) {
      meta.push({
        data: 'selection',
        name: 'selection',
        title:
          '<input type="checkbox" class="form-check-input skl-checkbox select-all-checkbox">',
        orderable: false,
        searchable: false,
        visible: true,
        width: 'auto',
        className: 'dt-checkbox',
        isDate: false,
        renderHtml: true,
      });
    }

    // ── Regular columns ──────────────────────────────────────
    for (const [displayName, columnDef] of Object.entries(columns)) {
      if (!Array.isArray(columnDef) || !columnDef[0]) {
        this.Developer.warn('Invalid column definition', {
          displayName,
          columnDef,
        });
        continue;
      }

      const dbColumn = columnDef[0];
      const isVisible = columnDef[1] ?? true;

      if (!isVisible) continue;

      const renderHtml = htmlColumns.some((c) => c.column === displayName);

      meta.push({
        data: displayName,
        name: dbColumn,
        title: toTitle(displayName),
        orderable: true,
        searchable: true,
        visible: true,
        width: 'auto',
        className: 'dt-left skl-pop',
        isDate: ['created_at', 'updated_at'].includes(displayName),
        renderHtml,
      });
    }

    // ── Addon columns ────────────────────────────────────────
    for (const addonDef of addonColumns) {
      const existing = meta.find((m) => m.data === addonDef.column);
      if (!existing) {
        meta.push({
          data: addonDef.column,
          name: addonDef.column,
          title: toTitle(addonDef.column),
          orderable: false,
          searchable: false,
          visible: true,
          width: 'auto',
          className: 'dt-left',
          isDate: false,
          renderHtml: addonDef.renderHtml ?? false,
        });
      }
    }

    // ── Actions column ───────────────────────────────────────
    if (showActions) {
      meta.push({
        data: 'actions',
        name: 'actions',
        title: 'Actions',
        orderable: false,
        searchable: false,
        visible: true,
        width: 'auto',
        className: 'dt-actions',
        isDate: false,
        renderHtml: true,
      });
    }

    return meta;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4.  renderView
  //     Template engine with ::col::, ::IF::, ::MATH::
  // ═══════════════════════════════════════════════════════════════

  renderView(
    view: string,
    row: Record<string, any>,
    validColumns: string[],
    renderHtml = false,
  ): string {
    let output = view;

    // ── ::MATH(expr):: ──────────────────────────────────────
    output = output.replace(/::MATH\((.+?)\)::/gs, (_, expr) =>
      this.evaluateMath(expr.trim(), row, validColumns),
    );

    // ── ::IF(cond, trueVal, falseVal):: with ELSEIF/ELSE ────
    const ifPattern =
      /::IF\(([^,]+?),\s*([^,]+?)(?:,\s*([^)]+?))?\)::((?:ELSEIF\(([^,]+?),\s*([^,]+?)(?:,\s*([^)]+?))?\)::)*)?(?:ELSE\(([^)]*?)\)::)?/;
    let match: RegExpExecArray | null;
    while ((match = ifPattern.exec(output)) !== null) {
      const conditions: {
        condition: string;
        value: string;
        elseValue: string;
      }[] = [
          {
            condition: match[1].trim(),
            value: match[2].trim(),
            elseValue: (match[3] ?? '').trim(),
          },
        ];

      if (match[4]) {
        const elseifPattern =
          /ELSEIF\(([^,]+?),\s*([^,]+?)(?:,\s*([^)]+?))?\)::/g;
        let em: RegExpExecArray | null;
        while ((em = elseifPattern.exec(match[4])) !== null) {
          conditions.push({
            condition: em[1].trim(),
            value: em[2].trim(),
            elseValue: (em[3] ?? '').trim(),
          });
        }
      }

      const elseValue = (
        match[8] ?? conditions[conditions.length - 1].elseValue
      ).trim();
      let result = elseValue;

      for (const cond of conditions) {
        if (this.evaluateCondition(cond.condition, row, validColumns)) {
          result = cond.value;
          break;
        }
      }

      output = output.replace(
        match[0],
        this.renderView(result, row, validColumns, renderHtml),
      );
    }

    // ── ::~Facade->method(args)->chain(args)~:: ─────────────
    output = output.replace(
      /::~([A-Z][a-zA-Z]*|(?:[A-Za-z\\]+\\[A-Za-z]+))->(\\w+)\(([^)]*)\)(?:->(\\w+)\(([^)]*)\))?~::/g,
      (_, cls, method1, args1, method2, args2) => {
        // In TS we can't dynamically call PHP facades; return placeholder
        const params1 = this.parseParameters(args1 ?? '', row, validColumns);
        const params2 = this.parseParameters(args2 ?? '', row, validColumns);
        return this.callMethod(
          cls,
          method1,
          params1,
          method2 ?? '',
          params2,
          row,
        );
      },
    );

    // ── ::ClassName::method(args):: (legacy) ────────────────
    output = output.replace(
      /::([A-Z][a-zA-Z]*)::(\w+)\(([^)]*)\)::/g,
      (_, cls, method, args) => {
        const params = this.parseParameters(args, row, validColumns);
        return this.callMethod(cls, method, params, '', [], row, true);
      },
    );

    // ── ::column_name:: placeholder replacement ─────────────
    // ── ::column_name:: placeholder replacement ─────────────
    output = output.replace(/::([\w.]+)::/g, (full, column: string) => {
      const originalCol = beforeFirst(column, ' AS ');
      const plainCol = afterLast(originalCol, '.');
      const colKey = plainCol.replace(/\./g, '_');

      return validColumns.includes(column) && row[colKey] != null
        ? this.handleBase64Data(row[colKey])
        : '';
    });

    output = output.replace(/ \+ /g, ' ');

    return renderHtml ? output : escapeHtml(output);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5.  evaluateCondition
  // ═══════════════════════════════════════════════════════════════

  evaluateCondition(
    condition: string,
    row: Record<string, any>,
    validColumns: string[],
  ): boolean {
    condition = condition.trim();

    // Unwrap parentheses
    const parenMatch = /^\((.+)\)$/s.exec(condition);
    if (parenMatch) {
      return this.evaluateCondition(parenMatch[1], row, validColumns);
    }

    // AND/OR compound
    const andOrPattern = /\s+(AND|OR)\s+/i;
    const andOrMatch = andOrPattern.exec(condition);
    if (andOrMatch) {
      const idx = andOrMatch.index;
      const left = condition.substring(0, idx).trim();
      const op = andOrMatch[1].toUpperCase();
      const right = condition.substring(idx + andOrMatch[0].length).trim();
      const leftResult = this.evaluateCondition(left, row, validColumns);
      const rightResult = this.evaluateCondition(right, row, validColumns);
      return op === 'AND'
        ? leftResult && rightResult
        : leftResult || rightResult;
    }

    // IN [...] check
    const inMatch = /^([\w.]+)\s*IN\s*\[\s*([^\]]*?)\s*\]$/i.exec(condition);
    if (inMatch) {
      const column = inMatch[1];
      const originalCol = beforeFirst(column, ' AS ');
      const plainCol = afterLast(originalCol, '.');
      const colKey = plainCol.replace(/\./g, '_');
      const values = inMatch[2]
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      return (
        validColumns.includes(column) &&
        row[colKey] != null &&
        values.includes(String(row[colKey]))
      );
    }

    // IS (NOT) NULL check
    const nullMatch = /^([\w.]+)\s*IS\s*(NOT\s*)?NULL$/i.exec(condition);
    if (nullMatch) {
      const column = nullMatch[1];
      const originalCol = beforeFirst(column, ' AS ');
      const plainCol = afterLast(originalCol, '.');
      const colKey = plainCol.replace(/\./g, '_');
      const isNotNull = !!nullMatch[2];
      const rowValue = row[colKey] ?? null;
      if (!validColumns.includes(column)) return false;
      return isNotNull
        ? rowValue !== null && rowValue !== ''
        : rowValue === null || rowValue === '';
    }

    // Comparison operators: =, !=, >, <, LIKE
    const cmpMatch = /^([\w.]+)\s*(=|>|<|!=|LIKE)\s*['"]?([^'"]*?)['"]?$/i.exec(
      condition,
    );
    if (cmpMatch) {
      const column = cmpMatch[1];
      const operator = cmpMatch[2].toUpperCase();
      const value = cmpMatch[3];
      const originalCol = beforeFirst(column, ' AS ');
      const plainCol = afterLast(originalCol, '.');
      const colKey = plainCol.replace(/\./g, '_');

      if (validColumns.includes(column) && row[colKey] != null) {
        const rowValue = row[colKey];
        switch (operator) {
          case '=':
            if (typeof rowValue === 'boolean') {
              return rowValue === (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 't');
            }
            if (value.toLowerCase() === 'true') {
              return rowValue === true || rowValue === 'true' || rowValue === 1 || rowValue === '1' || rowValue === 't';
            }
            if (value.toLowerCase() === 'false') {
              return rowValue === false || rowValue === 'false' || rowValue === 0 || rowValue === '0' || rowValue === 'f' || rowValue === null || rowValue === undefined || rowValue === '';
            }
            return rowValue == value;
          case '!=':
            if (typeof rowValue === 'boolean') {
              return rowValue !== (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 't');
            }
            if (value.toLowerCase() === 'true') {
              return !(rowValue === true || rowValue === 'true' || rowValue === 1 || rowValue === '1' || rowValue === 't');
            }
            if (value.toLowerCase() === 'false') {
              return !(rowValue === false || rowValue === 'false' || rowValue === 0 || rowValue === '0' || rowValue === 'f' || rowValue === null || rowValue === undefined || rowValue === '');
            }
            return rowValue != value;
          case '>':
            return (
              !isNaN(Number(rowValue)) &&
              !isNaN(Number(value)) &&
              Number(rowValue) > Number(value)
            );
          case '<':
            return (
              !isNaN(Number(rowValue)) &&
              !isNaN(Number(value)) &&
              Number(rowValue) < Number(value)
            );
          case 'LIKE':
            return String(rowValue)
              .toLowerCase()
              .includes(value.replace(/[%_]/g, '').toLowerCase());
          default:
            return false;
        }
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6.  evaluateMath
  // ═══════════════════════════════════════════════════════════════

  private evaluateMath(
    expr: string,
    row: Record<string, any>,
    validColumns: string[],
  ): string {
    // Replace column placeholders with numeric values
    const resolved = expr.replace(/::([\w.]+)::/g, (_, column: string) => {
      const originalCol = beforeFirst(column, ' AS ');
      const plainCol = afterLast(originalCol, '.');
      const colKey = plainCol.replace(/\./g, '_');

      return validColumns.includes(column) &&
        row[colKey] != null &&
        !isNaN(Number(row[colKey]))
        ? String(row[colKey])
        : '0';
    });

    // Validate only safe characters
    if (!/^[\d\s+\-*/().]+$/.test(resolved)) {
      this.Developer.warn('Invalid characters in math expression', {
        expr: resolved,
      });
      return '';
    }

    try {
      // Safe eval using Function constructor (no global scope access)
      const result = new Function(`return (${resolved})`)();
      return String(result);
    } catch (e: any) {
      this.Developer.warn('Error evaluating math expression', {
        expr: resolved,
        error: e?.message,
      });
      return '';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7.  callMethod
  // ═══════════════════════════════════════════════════════════════

  private callMethod(
    classOrFacade: string,
    method1: string,
    params1: any[],
    method2: string,
    params2: any[],
    row: Record<string, any>,
    _isLegacy = false,
  ): string {
    // Carbon date formatting (most common usage)
    if (
      classOrFacade === 'Carbon' &&
      method1 === 'parse' &&
      method2 === 'format'
    ) {
      try {
        const dateStr = String(params1[0] ?? '');
        const fmt = String(params2[0] ?? 'YYYY-MM-DD');
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        // Basic formatting
        const pad = (n: number) => String(n).padStart(2, '0');
        return fmt
          .replace('Y', String(d.getFullYear()))
          .replace('m', pad(d.getMonth() + 1))
          .replace('d', pad(d.getDate()))
          .replace('H', pad(d.getHours()))
          .replace('i', pad(d.getMinutes()))
          .replace('s', pad(d.getSeconds()));
      } catch {
        return '';
      }
    }

    // Default fallback

    return '';
  }

  // ═══════════════════════════════════════════════════════════════
  // 8.  parseParameters
  //     Splits comma-separated args, respecting quotes/nesting
  // ═══════════════════════════════════════════════════════════════

  private parseParameters(
    rawParams: string,
    row: Record<string, any>,
    validColumns: string[],
  ): any[] {
    if (!rawParams || rawParams.trim() === '') return [];

    const params: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar: string | null = null;
    const depth: Record<string, number> = { '(': 0, '[': 0 };
    let escaped = false;

    for (let i = 0; i < rawParams.length; i++) {
      const char = rawParams[i];

      if (char === '\\' && !escaped) {
        escaped = true;
        current += char;
        continue;
      }

      if ((char === '"' || char === "'") && !escaped) {
        if (inQuotes && char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        }
        current += char;
      } else if ((char === '(' || char === '[') && !inQuotes) {
        depth[char]++;
        current += char;
      } else if ((char === ')' || char === ']') && !inQuotes) {
        depth[char === ')' ? '(' : '[']--;
        current += char;
      } else if (
        char === ',' &&
        !inQuotes &&
        depth['('] === 0 &&
        depth['['] === 0
      ) {
        params.push(current.trim());
        current = '';
      } else {
        current += char;
      }

      escaped = false;
    }

    if (current.trim() !== '') {
      params.push(current.trim());
    }

    // Resolve each parameter
    return params.map((param) => {
      // Column placeholder  ::col_name::
      const colMatch = /^::([\w.]+)::$/.exec(param);
      if (colMatch) {
        const column = colMatch[1];
        const originalCol = beforeFirst(column, ' AS ');
        const plainCol = afterLast(originalCol, '.');
        const colKey = plainCol.replace(/\./g, '_');
        return validColumns.includes(column) && row[colKey] != null
          ? this.handleBase64Data(row[colKey])
          : '';
      }

      // String literal or number
      const litMatch = /^['"]?(.*?)['"]?$/.exec(param);
      if (litMatch) {
        const val = litMatch[1];
        if (!isNaN(Number(val)) && val !== '') {
          return val.includes('.') ? parseFloat(val) : parseInt(val, 10);
        }
        return val;
      }

      return param;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 9.  handleBase64Data
  // ═══════════════════════════════════════════════════════════════

  private handleBase64Data(data: any): any {
    if (typeof data !== 'string') {
      return typeof data === 'object' ? '' : data;
    }

    const b64Match = /^data:([a-zA-Z/]+);base64,(.+)$/.exec(data);
    if (!b64Match) return data;

    const mime = b64Match[1];

    if (mime.startsWith('image/')) return data;
    if (mime.startsWith('audio/'))
      return `<audio controls src="${data}"></audio>`;
    if (mime === 'application/pdf')
      return `<embed src="${data}" type="application/pdf" width="100%" height="600px" />`;
    if (mime.startsWith('video/'))
      return `<video controls src="${data}"></video>`;

    // General file download
    const ext =
      mime === 'text/plain'
        ? 'txt'
        : mime === 'application/json'
          ? 'json'
          : mime === 'text/csv'
            ? 'csv'
            : 'dat';
    return `<a href="${data}" download="file.${ext}">Download file</a>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Error response helper
  // ═══════════════════════════════════════════════════════════════

  private errorResponse(message: string, reqSet: any): TableResponse {
    return {
      status: false,
      draw: Number(reqSet?.draw ?? 1),
      data: [],
      columns: [],
      recordsTotal: 0,
      recordsFiltered: 0,
      message,
    };
  }
}
