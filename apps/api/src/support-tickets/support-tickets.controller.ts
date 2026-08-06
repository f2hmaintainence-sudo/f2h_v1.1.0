import { Controller, Post, Get, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SupportTicketsService } from './support-tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Controller({ path: 'support-tickets', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class SupportTicketsController {
  constructor(private readonly ticketsService: SupportTicketsService) {}

  @Post()
  async createTicket(@Request() req: any, @Body() dto: CreateTicketDto) {
    const userId = req.user?.user_id;
    return this.ticketsService.createTicket(userId, dto);
  }

  @Get()
  async getUserTickets(@Request() req: any) {
    const userId = req.user?.user_id;
    return this.ticketsService.getUserTickets(userId);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadAttachment(@UploadedFile() file: any) {
    return this.ticketsService.uploadAttachment(file);
  }
}
