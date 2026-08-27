import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';

export interface UpdateTicketStatusDto {
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_notes?: string;
  adminNotes?: string;
}

@Injectable()
export class DeliveryPartnerTicketService {
  constructor(private readonly db: DatabaseService) {}

  async getTickets(query: {
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    page?: string | number;
    limit?: string | number;
  }) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 20), 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["st.deleted_at IS NULL", "st.user_type = 'delivery_partner'"];
    const params: any[] = [];
    let pIdx = 1;

    if (query.status && query.status.toUpperCase() !== 'ALL') {
      const normalizedStatus = query.status.toLowerCase();
      conditions.push(`st.status = $${pIdx++}::support_status`);
      params.push(normalizedStatus);
    }

    if (query.priority && query.priority.toUpperCase() !== 'ALL') {
      conditions.push(`st.priority ILIKE $${pIdx++}`);
      params.push(query.priority.toLowerCase());
    }

    if (query.category && query.category.toUpperCase() !== 'ALL') {
      conditions.push(`st.category ILIKE $${pIdx++}`);
      params.push(query.category.toLowerCase());
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(`(
        st.ticket_id ILIKE $${pIdx} OR
        st.subject ILIKE $${pIdx} OR
        st.description ILIKE $${pIdx} OR
        u.first_name ILIKE $${pIdx} OR
        u.last_name ILIKE $${pIdx} OR
        u.phone ILIKE $${pIdx} OR
        st.user_id ILIKE $${pIdx}
      )`);
      params.push(s);
      pIdx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Fetch paginated tickets
    const sql = `
      SELECT
        st.ticket_id,
        st.user_id,
        st.user_type,
        st.category,
        st.subject,
        st.description,
        st.priority,
        st.status,
        st.attachments,
        st.admin_notes,
        st.created_at,
        st.updated_at,
        COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, 'Delivery Partner') AS partner_name,
        COALESCE(u.phone, '') AS partner_phone,
        COALESCE(u.email, '') AS partner_email,
        dp.vehicle_type,
        dp.vehicle_number,
        dp.branch_id
      FROM support_tickets st
      LEFT JOIN users u ON u.user_id = st.user_id
      LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = st.user_id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN st.status = 'open' THEN 1
          WHEN st.status = 'in_progress' THEN 2
          WHEN st.status = 'resolved' THEN 3
          ELSE 4
        END ASC,
        CASE 
          WHEN st.priority = 'critical' THEN 1
          WHEN st.priority = 'high' THEN 2
          WHEN st.priority = 'medium' THEN 3
          ELSE 4
        END ASC,
        st.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM support_tickets st
      LEFT JOIN users u ON u.user_id = st.user_id
      LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = st.user_id
      ${whereClause}
    `;

    const summarySql = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
        COUNT(*)::int AS total
      FROM support_tickets
      WHERE deleted_at IS NULL AND user_type = 'delivery_partner'
    `;

    const [rows, countRes, summaryRes] = await Promise.all([
      this.db.query(sql, [...params, limit, offset]),
      this.db.query(countSql, params),
      this.db.query(summarySql),
    ]);

    const total = countRes[0]?.total || 0;
    const summary = summaryRes[0] || {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      total: 0,
    };

    const formattedRows = (rows || []).map((row: any) => {
      let parsedAttachments: string[] = [];
      if (row.attachments) {
        try {
          parsedAttachments = typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments;
        } catch {
          parsedAttachments = [String(row.attachments)];
        }
      }
      return {
        ...row,
        attachments: Array.isArray(parsedAttachments) ? parsedAttachments : [],
      };
    });

    return {
      success: true,
      data: formattedRows,
      summary,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async updateTicketStatus(ticketId: string, status: string, notes?: string) {
    const normalizedStatus = (status || '').toLowerCase();
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];

    if (!validStatuses.includes(normalizedStatus)) {
      throw new BadRequestException(`Invalid status: ${status}. Valid options are ${validStatuses.join(', ')}`);
    }

    const check = await this.db.query(
      `SELECT ticket_id, status FROM support_tickets WHERE ticket_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [ticketId],
    );

    if (!check?.length) {
      throw new NotFoundException(`Ticket #${ticketId} not found`);
    }

    const updated = await this.db.query(
      `UPDATE support_tickets
       SET status = $1::support_status,
           admin_notes = COALESCE($2, admin_notes),
           updated_at = NOW()
       WHERE ticket_id = $3
       RETURNING *`,
      [normalizedStatus, notes !== undefined ? notes : null, ticketId],
    );

    return {
      success: true,
      message: `Ticket #${ticketId} updated to ${normalizedStatus}`,
      data: updated[0],
    };
  }

  async deleteTicket(ticketId: string) {
    const check = await this.db.query(
      `SELECT ticket_id FROM support_tickets WHERE ticket_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [ticketId],
    );

    if (!check?.length) {
      throw new NotFoundException(`Ticket #${ticketId} not found`);
    }

    await this.db.query(
      `UPDATE support_tickets SET deleted_at = NOW(), updated_at = NOW() WHERE ticket_id = $1`,
      [ticketId],
    );

    return {
      success: true,
      message: `Ticket #${ticketId} deleted successfully`,
    };
  }
}
