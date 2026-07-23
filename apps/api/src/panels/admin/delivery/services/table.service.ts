import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TableHelper, TableSet, ReqSet } from '../../../../helpers/TableHelper';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

function extractFilters(query: any) {
  const columns: Record<string, string[]> = {};
  const dateRange: Record<string, any> = {};
  for (const [key, val] of Object.entries(query || {})) {
    if (key.startsWith('col_')) {
      columns[key.substring(4)] = Array.isArray(val) ? val.map(String) : [String(val)];
    } else if (key.startsWith('date_')) {
      const match = key.match(/^date_(.+)_(from|to)$/);
      if (match) {
        if (!dateRange[match[1]]) dateRange[match[1]] = {};
        dateRange[match[1]][match[2]] = val;
      }
    }
  }
  return { columns, dateRange };
}

@Injectable()
export class DeliveryLeaveTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) {}

  async getLeaveRequestsTable(query: any) {
    try {
      const conditions: any[] = [];

      if (query.status) {
        conditions.push({
          column: 'delivery_leave_requests.status',
          operator: '=',
          value: query.status,
        });
      }

      if (query.delivery_partner_id) {
        conditions.push({
          column: 'delivery_leave_requests.delivery_partner_id',
          operator: '=',
          value: query.delivery_partner_id,
        });
      }

      const reqSet: ReqSet = {
        key: 'delivery_leave_requests',
        table: 'delivery_leave_requests',
        actions: 'v',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'DESC' }
            : { 'delivery_leave_requests.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 20,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id:               ['delivery_leave_requests.id', false],
          delivery_partner_id:  ['delivery_leave_requests.delivery_partner_id', true],
          delivery_partner_name:['delivery_partners.full_name', true],
          leave_date:       ['delivery_leave_requests.leave_date', true],
          end_date:         ['delivery_leave_requests.end_date', true],
          leave_type:       ['delivery_leave_requests.leave_type', true],
          half_day_shift:   ['delivery_leave_requests.half_day_shift', true],
          reason:           ['delivery_leave_requests.reason', true],
          status:           ['delivery_leave_requests.status', true],
          admin_remarks:    ['delivery_leave_requests.admin_remarks', true],
          notified_at:      ['delivery_leave_requests.notified_at', true],
          created_at:       ['delivery_leave_requests.created_at', true],
        },
        joins: [
          {
            type: 'LEFT',
            table: 'delivery_partners',
            on: [['delivery_partners.delivery_partner_id', 'delivery_leave_requests.delivery_partner_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'modify',
            column: 'status',
            view:
              '::IF(status = pending, <span class="badge badge-warning">Pending</span>)::' +
              'ELSEIF(status = approved, <span class="badge badge-success">Approved</span>)::' +
              'ELSEIF(status = rejected, <span class="badge badge-danger">Rejected</span>)::' +
              'ELSE(<span class="badge badge-secondary">{status}</span>)::',
            renderHtml: true,
          },
          {
            type: 'modify',
            column: 'leave_type',
            view:
              '::IF(leave_type = full_day, <span class="badge badge-info">Full Day</span>)::' +
              'ELSE(<span class="badge badge-secondary">Half Day</span>)::',
            renderHtml: true,
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getLeaveRequestsTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve leave requests table');
    }
  }
}
