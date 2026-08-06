import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../shared/database/Database.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { generateId } from '../helpers/RandomHelper';

@Injectable()
export class SupportTicketsService {
  constructor(private readonly db: DatabaseService) {}

  async createTicket(userId: string, dto: CreateTicketDto) {
    // Resolve user_type based on role_id in the users table
    const userRes = await this.db.query(
      `SELECT role_id FROM users WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    if (!userRes?.length) {
      throw new BadRequestException('User not found');
    }

    const roleId = userRes[0].role_id;
    let userType = 'customer';
    if (roleId === 'DELIVERY_PARTNER') {
      userType = 'delivery_partner';
    } else if (roleId === 'VENDOR') {
      userType = 'vendor';
    }

    const ticketId = generateId('TKT', 12);

    await this.db.query(
      `INSERT INTO support_tickets (
        ticket_id, user_id, user_type, category, subject, 
        description, priority, status, attachments, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open'::support_status, $8, NOW(), NOW())`,
      [
        ticketId,
        userId,
        userType,
        dto.category,
        dto.subject,
        dto.description || null,
        dto.priority || 'medium',
        dto.attachments ? JSON.stringify(dto.attachments) : null,
      ],
    );

    return {
      success: true,
      ticket_id: ticketId,
      message: 'Ticket raised successfully',
    };
  }

  async getUserTickets(userId: string) {
    const tickets = await this.db.query(
      `SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return {
      success: true,
      data: tickets || [],
    };
  }

  async uploadAttachment(file: any): Promise<{ success: boolean; url: string }> {
    if (!file) throw new BadRequestException('No file provided');

    const docDir = path.join(process.cwd(), 'uploads', 'support-tickets');
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }

    const ext = path.extname(file.originalname || 'attachment.jpg') || '.jpg';
    const filename = `ticket_attach_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
    const filePath = path.join(docDir, filename);
    
    fs.writeFileSync(filePath, file.buffer);

    const fileUrl = `uploads/support-tickets/${filename}`;
    return { success: true, url: fileUrl };
  }
}
