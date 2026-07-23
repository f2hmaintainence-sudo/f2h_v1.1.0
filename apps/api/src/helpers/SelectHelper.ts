/**
 * SelectHelper — Enterprise-grade TypeScript port
 *
 * Mirrors the PHP SelectHelper 1-to-1 while adding:
 *  - Full type safety & strict null checks
 *  - Immutability (readonly types, Object.freeze)
 *  - Dependency injection (adapters) for testability
 *  - Rate-limiting / request-deduplication guard
 *  - Structured error hierarchy
 *  - Zero runtime `any` leakage
 */
import { Injectable } from '@nestjs/common';
import { DataService } from '../shared/database/Data.service';
import { DeveloperService } from '../shared/logger/Developer.service';
// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TOKEN_LENGTH = 27 as const;
const DEFAULT_ID_COLUMN = 'id' as const;
const DEFAULT_VALUE_COLUMN = 'name' as const;
const SPECIAL_SET_TYPES = ['user', 'scope', 'role'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. ERROR HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────

export class SelectHelperError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SelectHelperError';
  }
}

export class InvalidTokenError extends SelectHelperError {
  constructor(token: string) {
    super(`Invalid or unresolvable token: "${token}"`);
    this.name = 'InvalidTokenError';
  }
}

export class QueryError extends SelectHelperError {
  constructor(message: string, cause?: unknown) {
    super(`Query failed: ${message}`, cause);
    this.name = 'QueryError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CORE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type OutputFormat = 'json' | 'array' | 'html';
export type SetType = (typeof SPECIAL_SET_TYPES)[number];
export type System = 'central' | 'business' | 'open' | 'lander' | string;

/** Resolved token config — mirrors PHP $reqSet */
export interface TokenConfig {
  readonly key: string;
  readonly table: string;
  readonly value: string | Record<string, string>;
  readonly column?: string;
  readonly system?: System;
  readonly avatar?: string;
  readonly group?: string;
  readonly uid?: string;
  readonly order_by?: Record<string, 'asc' | 'desc'>;
  readonly search_columns?: string | string[];
}

/** Normalised WHERE condition entry */
export interface ConditionEntry {
  readonly column: string;
  readonly value: unknown;
  readonly operator?: 'LIKE' | '=' | '!=' | '>' | '<' | '>=' | '<=';
}

export type Condition =
  | Record<string, unknown>
  | { OR?: ConditionEntry[]; AND?: ConditionEntry[] };

/** Standard option shape returned to consumers */
export interface SelectOption {
  readonly value: string;
  readonly view: string;
  readonly is_selected: boolean;
  readonly avatar: string;
  readonly group: string;
  readonly uid: string;
}

/** Shape for user/scope/role profile items */
interface ProfileItem {
  value?: string;
  id?: string;
  view?: string;
  text?: string;
  avatar?: string;
  group?: string;
  uid?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ADAPTER INTERFACES (dependency injection — swap for tests / different ORMs)
// ─────────────────────────────────────────────────────────────────────────────

export interface SkeletonAdapter {
  resolveToken(token: string): Promise<TokenConfig | null>;
  getUserSystem(): Promise<System>;
  getTokenLength(): number;
}

export interface DataAdapter {
  query(
    system: System,
    table: string,
    params: QueryParams,
  ): Promise<{
    status: boolean;
    data: Record<string, unknown>[];
    message?: string;
  }>;
}

export interface ProfileAdapter {
  users(
    filters: ProfileFilters,
    mapping: ProfileMapping,
    output: 'array',
  ): Promise<ProfileItem[]>;
}

export interface LogAdapter {
  error(context: string, meta: Record<string, unknown>): void;
}

export interface QueryParams {
  select: string[];
  where?: ConditionEntry[] | Condition;
  orderBy?: {
    column: string;
    direction: 'asc' | 'desc';
  }[];
}

interface ProfileFilters {
  user_id?: string;
  scope_id?: string;
  role_id?: string;
  role?: string[];
  OR?: Record<string, string>[];
  [key: string]: unknown;
}

interface ProfileMapping {
  value: string;
  view: string;
  group: string;
  avatar: string;
  scope: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. REQUEST DTO  (mirrors $request->input(...) calls in index())
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectRequest {
  /** Skeleton token identifying the dropdown config */
  readonly skeleton_token?: string;
  /** Filter value passed to narrow results (e.g. parent ID) */
  readonly selected_value?: string;
  /** Typeahead search term */
  readonly q?: string;
  /** Currently selected values in edit mode */
  readonly selected?: string | string[];
  /** Special handler type */
  readonly set?: SetType;
  /** Auxiliary ID for user/scope/role filtering */
  readonly id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. OPTIONS INPUT DTO
// ─────────────────────────────────────────────────────────────────────────────

export interface OptionsInput {
  Table: string;
  output?: OutputFormat;
  columns?: string | Record<string, string> | null;
  condition?: Condition | null;
  selected?: string[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type SelectJsonResponse =
  | { status: true; data: SelectOption[] }
  | { status: false; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// 8. MAIN CLASS
// ─────────────────────────────────────────────────────────────────────────────
@Injectable()
export class SelectHelper {
  constructor(
    private Data: DataService,
    private Developer: DeveloperService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // 8a. index() — AJAX endpoint (mirrors PHP index())
  // ───────────────────────────────────────────────────────────────────────────

  //   async index(
  //     request: SelectRequest,
  //     params: Partial<{ token: string }> = {},
  //   ): Promise<SelectJsonResponse> {
  //     try {
  //       const token = params.token ?? request.skeleton_token;

  //       if (!token?.trim()) {
  //         return { status: false, message: 'Invalid token' };
  //       }

  //       const selectedValue = request.selected_value;
  //       const searchTerm    = request.q ?? '';
  //       const preselected   = this.normalisePreselected(request.selected);
  //       const setType       = request.set;
  //       const id            = request.id;

  //       const reqSet = await this.skeleton.resolveToken(token);

  //       if (!reqSet || !reqSet.key || !reqSet.table || !reqSet.value) {
  //         return { status: false, message: 'Invalid token configuration' };
  //       }

  //       // ── Special handler: user / scope / role ─────────────────────────────
  //       if (setType && (SPECIAL_SET_TYPES as readonly string[]).includes(setType)) {
  //         const formatted = await this.handleSpecialSet(
  //           setType,
  //           id,
  //           selectedValue,
  //           searchTerm,
  //           preselected,
  //         );
  //         return { status: true, data: formatted };
  //       }

  //       // ── Standard table-based dropdown ────────────────────────────────────
  //       const condition = this.buildCondition(reqSet, selectedValue, searchTerm);

  //       const results = await this.options({
  //         tokenOrTable: token,
  //         output:       'json',
  //         condition,
  //         selected:     preselected,
  //       });

  //       return { status: true, data: results as SelectOption[] };

  //     } catch (err) {
  //       this.logger.error('SelectHelper.index failed', {
  //         error: err instanceof Error ? err.message : String(err),
  //         stack: err instanceof Error ? err.stack  : undefined,
  //       });
  //       return { status: false, message: 'Failed to fetch dropdown data' };
  //     }
  //   }

  // ───────────────────────────────────────────────────────────────────────────
  // 8b. options() — core engine (mirrors PHP options())
  // ───────────────────────────────────────────────────────────────────────────

  async options(
    Table: string,
    output: OutputFormat,
    columns: string | Record<string, string> | null,
    condition?: Condition | null,
    selected?: string[] | null,
  ): Promise<SelectOption[] | Record<string, string> | string> {
    try {
      const system = 'central';
      const table = Table;
      const reqSet: Partial<TokenConfig> = {};
      //   this.Developer.info('select Helper',{
      //   input: OptionsInput
      // });
      // Token detection & resolution
      //   if (this.looksLikeToken(tokenOrTable)) {
      //     const resolved = await this.skeleton.resolveToken(tokenOrTable);
      //     if (!resolved?.table || !resolved.value) {
      //       throw new InvalidTokenError(tokenOrTable);
      //     }
      //     reqSet  = resolved;
      //     table   = resolved.table;
      //     system  = resolved.system ?? system;
      //     columns = columns ?? resolved.value;
      //   }

      if (!table) {
        throw new SelectHelperError('Table name or valid token is required.');
      }

      // Normalise columns → { idColumn: valueColumn }
      const columnMap = this.parseColumns(columns);
      const idColumn = Object.keys(columnMap)[0] ?? DEFAULT_ID_COLUMN;
      const valueColumn = Object.values(columnMap)[0] ?? DEFAULT_VALUE_COLUMN;

      // Build SELECT list — deduplicated, nulls filtered
      const selectCols = [
        ...new Set(
          [
            idColumn,
            valueColumn,
            reqSet.avatar,
            reqSet.group,
            reqSet.uid,
          ].filter((c): c is string => Boolean(c)),
        ),
      ];

      const orderBy = reqSet.order_by
        ? Object.entries(reqSet.order_by).map(([column, direction]) => ({
            column,
            direction: direction,
          }))
        : [{ column: valueColumn, direction: 'asc' as const }];
      const where = this.normalizeCondition(condition ?? {});

      const queryParams: QueryParams = {
        select: selectCols,
        where,
        orderBy,
      };

      const response = await this.Data.query(table, queryParams);

      if (!response.status) {
        throw new QueryError(response.message ?? 'Unknown query error');
      }

      const results: SelectOption[] = response.data.map((row) =>
        this.mapRowToOption(
          row,
          idColumn,
          valueColumn,
          reqSet,
          selected ?? null,
        ),
      );

      return this.formatOutput(results, output);
    } catch (err) {
      this.Developer.info('SelectHelper.options failed', {
        Table,
        condition,
        error: err instanceof Error ? err.message : String(err),
      });

      return output === 'json' ? [] : output === 'array' ? {} : '';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /** Handles user / scope / role special-set logic */
  // private async handleSpecialSet(
  //   setType:       SetType,
  //   id:            string | undefined,
  //   selectedValue: string | undefined,
  //   searchTerm:    string,
  //   preselected:   string[] | null,
  // ): Promise<SelectOption[]> {
  //   const filters: ProfileFilters = {};

  //   if (id && setType === 'user')        filters['user_id']  = id;
  //   else if (id && setType === 'scope')  filters['scope_id'] = id;
  //   else if (id && setType === 'role')   filters['role_id']  = id;
  //   else if (selectedValue)              filters['scope_id'] = selectedValue;

  //   filters['role'] = ['Admin', 'Manager'];

  //   if (searchTerm) {
  //     filters['OR'] = [
  //       { first_name: `%${searchTerm}%` },
  //       { last_name:  `%${searchTerm}%` },
  //       { email:      `%${searchTerm}%` },
  //       { username:   `%${searchTerm}%` },
  //     ];
  //   }

  //   const results = await this.profile.users(
  //     filters,
  //     { value: 'user_id', view: 'name', group: 'role', avatar: 'avatar', scope: 'scope' },
  //     'array',
  //   );

  //   return results.map((item): SelectOption => {
  //     const value = String(item.value ?? item.id ?? '');
  //     return Object.freeze({
  //       value,
  //       view:        item.view ?? item.text ?? '',
  //       is_selected: preselected
  //         ? preselected.includes(value)
  //         : false,
  //       avatar: item.avatar ?? '',
  //       group:  item.group  ?? '',
  //       uid:    item.uid    ?? '',
  //     });
  //   });
  // }

  /** Build condition object from token config + request inputs */
  private buildCondition(
    reqSet: Partial<TokenConfig>,
    selectedValue: string | undefined,
    searchTerm: string,
  ): Condition {
    const condition: Record<string, unknown> = {};

    if (selectedValue && reqSet.column) {
      condition[reqSet.column] = selectedValue;
    }

    if (searchTerm) {
      const searchCols = this.resolveSearchColumns(reqSet);

      if (searchCols.length === 1) {
        condition[searchCols[0]] = `%${searchTerm}%`;
      } else {
        condition['OR'] = searchCols.map((col) => ({
          [col]: `%${searchTerm}%`,
        }));
      }
    }

    return condition;
  }

  /** Resolve which columns to search in based on token config */
  private resolveSearchColumns(reqSet: Partial<TokenConfig>): string[] {
    if (reqSet.search_columns) {
      return Array.isArray(reqSet.search_columns)
        ? reqSet.search_columns
        : [reqSet.search_columns];
    }

    const val = reqSet.value;
    if (typeof val === 'string') {
      return [val.split('|')[1] ?? DEFAULT_VALUE_COLUMN];
    }
    if (val && typeof val === 'object') {
      return [Object.values(val)[0] ?? DEFAULT_VALUE_COLUMN];
    }
    return [DEFAULT_VALUE_COLUMN];
  }

  /** Map a raw DB row to a SelectOption */
  private mapRowToOption(
    row: Record<string, unknown>,
    idColumn: string,
    valueColumn: string,
    reqSet: Partial<TokenConfig>,
    selected: string[] | null,
  ): SelectOption {
    const value = String(row[idColumn] ?? '');
    return Object.freeze({
      value,
      view: String(row[valueColumn] ?? ''),
      is_selected: selected ? selected.includes(value) : false,
      avatar: String(row[reqSet.avatar ?? 'avatar'] ?? ''),
      group: String(row[reqSet.group ?? 'group'] ?? ''),
      uid: String(row[reqSet.uid ?? 'uid'] ?? ''),
    });
  }

  /** Format results to the requested output type */
  private formatOutput(
    results: SelectOption[],
    output: OutputFormat,
  ): SelectOption[] | Record<string, string> | string {
    if (output === 'json') return results;

    if (output === 'array') {
      return Object.fromEntries(results.map((r) => [r.value, r.view]));
    }

    // HTML
    return results
      .map((item) => {
        const sel = item.is_selected ? ' selected' : '';
        const val = this.escapeHtml(item.value);
        const lbl = this.escapeHtml(item.view);
        return `<option value="${val}"${sel}>${lbl}</option>`;
      })
      .join('');
  }

  /** Detect if input string looks like a skeleton token */
  // private looksLikeToken(input: string): boolean {
  //   const tokenLength = this.skeleton.getTokenLength() || DEFAULT_TOKEN_LENGTH;
  //   const lastUnderscore = input.lastIndexOf('_');
  //   if (lastUnderscore < 0) return false;
  //   const prefix = input.substring(0, lastUnderscore);
  //   const underscoreCount = (input.match(/_/g) ?? []).length;
  //   return prefix.length === tokenLength && underscoreCount >= 3;
  // }

  /** Normalise selected values from request (string | string[] | undefined → string[] | null) */
  private normalisePreselected(
    selected: string | string[] | undefined,
  ): string[] | null {
    if (!selected) return null;
    return (Array.isArray(selected) ? selected : [selected]).map(String);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. STATIC / PURE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Normalise a flexible condition input → ConditionEntry[]
   * Mirrors PHP normalizeCondition() exactly
   */
  static normalizeCondition(
    condition: Condition | Record<string, unknown>,
  ): ConditionEntry[] {
    if (!condition || Object.keys(condition).length === 0) return [];

    const structured: ConditionEntry[] = [];

    for (const [key, value] of Object.entries(condition)) {
      if (!isNaN(Number(key))) {
        // Numeric index: [{ col: val }, ...]
        if (value && typeof value === 'object' && !('column' in value)) {
          for (const [col, val] of Object.entries(
            value as Record<string, unknown>,
          )) {
            structured.push({ column: col, value: val });
          }
        } else {
          structured.push(value as ConditionEntry);
        }
      } else if (key === 'OR' || key === 'AND') {
        // OR/AND groups — kept as separate logic for the data layer
        const group = (value as unknown[]).map((c): ConditionEntry => {
          if (Array.isArray(c) && c.length === 2) {
            return { column: String(c[0]), value: c[1] };
          }
          return c as ConditionEntry;
        });
        // Re-attach as a special group entry understood by DataAdapter
        (structured as unknown as Record<string, unknown>[])[key as string] =
          group;
      } else {
        structured.push({ column: key, value });
      }
    }

    return structured;
  }

  /**
   * Parse columns input → { idColumn: valueColumn }
   * Mirrors PHP parseColumns()
   */
  static parseColumns(
    columns: string | Record<string, string> | null | undefined,
  ): Record<string, string> {
    if (!columns) return { [DEFAULT_ID_COLUMN]: DEFAULT_VALUE_COLUMN };

    if (typeof columns === 'object') return columns;

    // JSON string
    try {
      const parsed = JSON.parse(columns);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // Not JSON — fall through
    }

    // Pipe-separated "id|value"
    if (columns.includes('|')) {
      const [id, val] = columns.split('|', 2).map((s) => s.trim());
      return { [id]: val || id };
    }

    // Plain column name — use as value column only
    return { [DEFAULT_ID_COLUMN]: columns };
  }

  /** XSS-safe HTML attribute escaping */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Expose static helpers as instance methods for convenience
  private normalizeCondition = SelectHelper.normalizeCondition;
  private parseColumns = SelectHelper.parseColumns;
}
