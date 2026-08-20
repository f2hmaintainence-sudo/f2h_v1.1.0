import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FinanceRepository } from '../repository/finance.repository';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly repository: FinanceRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async getSubscriberOutstandings(query: any): Promise<any> {
    const res = await this.repository.getSubscriberOutstandingBills(query);
    return {
      status: true,
      data: res.bills,
      meta: {
        total: res.total,
        page: Number(query.page || 1),
        limit: Number(query.limit || 20),
        totalPages: Math.ceil(res.total / Math.max(1, Number(query.limit || 20))),
      },
    };
  }

  async getSubscriberOutstandingsStats(): Promise<any> {
    const stats = await this.repository.getSubscriberOutstandingsStats();
    return {
      status: true,
      data: stats,
    };
  }

  async getCombinedPayments(query: any): Promise<any> {
    const res = await this.repository.getCombinedPaymentsReport(query);
    return {
      status: true,
      data: res.data,
      meta: {
        total: res.total,
        page: Number(query.page || 1),
        limit: Number(query.limit || 20),
        totalPages: Math.ceil(res.total / Math.max(1, Number(query.limit || 20))),
      },
    };
  }

  async getPaymentsStats(days = 30): Promise<any> {
    const stats = await this.repository.getPaymentsStats(days);
    return {
      status: true,
      data: stats,
    };
  }

  async payBill(id: string, amount: number, paymentMode?: string, referenceNumber?: string, notes?: string): Promise<any> {
    const bill = await this.repository.findBillById(id);
    if (!bill) {
      throw new NotFoundException(`Postpaid bill ${id} not found.`);
    }

    if (bill.status === 'paid') {
      return { status: false, message: 'This bill is already fully paid.' };
    }

    const payAmt = Number(amount || 0);
    if (payAmt <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const currentPaid = Number(bill.paid_amount || 0);
    const totalAmt = Number(bill.total_amount || 0);
    const newPaid = Math.min(totalAmt, currentPaid + payAmt);
    let newStatus = 'partial';
    if (newPaid >= totalAmt) {
      newStatus = 'paid';
    }

    const updated = await this.repository.updateBillPayment(bill.id, newPaid, newStatus);
    return {
      status: true,
      message: 'Payment recorded successfully.',
      data: updated,
    };
  }

  async sendBillReminder(billId: string, customMessage?: string): Promise<any> {
    const bill = await this.repository.findBillById(billId);
    if (!bill) throw new NotFoundException('Bill not found');

    const dueAmountStr = `₹${Number(bill.due_amount || bill.total_amount || 0).toFixed(2)}`;
    const dueDateStr = bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'immediate';
    const bodyText = customMessage || `Dear ${bill.customer_name || 'Customer'}, your bill #${bill.bill_number || bill.id} of ${dueAmountStr} is pending (Due: ${dueDateStr}). Settle now via F2H App to maintain uninterrupted deliveries.`;

    await this.pushNotificationService.sendNotificationToUsers(
      [bill.customer_id],
      {
        title: '🔔 F2H Bill Due Date Intimation',
        body: bodyText,
      },
    ).catch(() => {});

    return {
      status: true,
      message: `Due date reminder sent to ${bill.customer_name || bill.customer_id} for ${dueAmountStr}.`,
    };
  }

  async sendBulkBillReminders(body: { billIds?: string[]; overdueOnly?: boolean; customMessage?: string }): Promise<any> {
    const { billIds, overdueOnly, customMessage } = body || {};
    let targetBills: any[] = [];

    if (billIds && billIds.length > 0) {
      targetBills = await this.repository.findBillsByIds(billIds);
    } else {
      const res = await this.repository.getSubscriberOutstandingBills({
        status: overdueOnly ? 'overdue' : undefined,
        limit: 500,
      });
      targetBills = res.bills || [];
    }

    if (targetBills.length === 0) {
      return {
        status: true,
        sentCount: 0,
        message: 'No pending customer bills found to intimate.',
      };
    }

    let sentCount = 0;
    const notifiedCustomers = new Set<string>();

    for (const bill of targetBills) {
      if (!bill.customer_id || notifiedCustomers.has(bill.customer_id)) continue;
      const dueAmountStr = `₹${Number(bill.due_amount || bill.total_amount || 0).toFixed(2)}`;
      const dueDateStr = bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'immediate';
      const bodyText = customMessage || `Dear ${bill.customer_name || 'Customer'}, your pending bill #${bill.bill_number || bill.id} of ${dueAmountStr} is awaiting payment (Due: ${dueDateStr}). Please settle now via F2H App.`;

      await this.pushNotificationService.sendNotificationToUsers(
        [bill.customer_id],
        {
          title: '🔔 F2H Bill Payment Due Reminder',
          body: bodyText,
        },
      ).catch(() => {});

      notifiedCustomers.add(bill.customer_id);
      sentCount++;
    }

    return {
      status: true,
      sentCount,
      totalBills: targetBills.length,
      message: `Successfully dispatched due date intimations to ${sentCount} customers.`,
    };
  }

  /**
   * @param requesterCustomerId when set, the receipt must belong to this customer.
   *   Admin callers pass `undefined`; customer-facing routes always pass the id from
   *   the token, so a customer cannot read another customer's invoice by guessing
   *   a bill id.
   */
  async getBillReceipt(id: string, requesterCustomerId?: string): Promise<any> {
    const data = await this.repository.getBillReceipt(id);
    if (!data) {
      throw new NotFoundException(`Invoice receipt ${id} not found.`);
    }
    if (requesterCustomerId && data.bill?.customer_id !== requesterCustomerId) {
      // Reported as "not found" rather than "forbidden" so the response does not
      // confirm that a bill with this id exists.
      throw new NotFoundException(`Invoice receipt ${id} not found.`);
    }
    return {
      status: true,
      data,
    };
  }

  async getBillReceiptPdf(
    id: string,
    requesterCustomerId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const res = await this.getBillReceipt(id, requesterCustomerId);
    const { bill, items } = res.data;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit');
    const { PassThrough } = require('stream');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 30, bottom: 30, left: 35, right: 35 },
      bufferPages: true,
    });

    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.pipe(stream);

    // Green brand banner
    doc.rect(0, 0, 595, 75).fill('#16a34a');
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text('F2H FRESH (Farm to Home)', 35, 18);
    doc.font('Helvetica').fontSize(10).fillColor('#dcfce7').text('Daily Farm Fresh Supply & Subscriptions', 35, 44);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text('OFFICIAL TAX INVOICE', 35, 44, { align: 'right', width: 525 });

    // Details header box
    const startY = 90;
    doc.rect(35, startY, 525, 80).fillAndStroke('#f8fafc', '#e2e8f0');

    // Customer info on left
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('BILLED CUSTOMER:', 45, startY + 10);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#15803d').text(bill.customer_name || 'Customer', 45, startY + 24);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`Phone: ${bill.customer_phone || 'N/A'}  •  Email: ${bill.customer_email || 'N/A'}`, 45, startY + 38);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`Address: ${bill.customer_address || 'N/A'}`, 45, startY + 52, { width: 300 });

    // Invoice meta on right
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`Invoice #: ${bill.bill_number || bill.bill_id}`, 360, startY + 10, { width: 190, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`Date: ${new Date(bill.created_at || Date.now()).toLocaleDateString('en-IN')}`, 360, startY + 24, { width: 190, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`Mode: ${(bill.payment_method || 'WALLET').toUpperCase()}`, 360, startY + 38, { width: 190, align: 'right' });
    const isPaid = (bill.status || '').toLowerCase() === 'paid';
    doc.font('Helvetica-Bold').fontSize(10).fillColor(isPaid ? '#16a34a' : '#dc2626').text(`Status: ${isPaid ? 'PAID' : 'DUE / PENDING'}`, 360, startY + 52, { width: 190, align: 'right' });

    // Table Header
    const tableTop = startY + 95;
    doc.rect(35, tableTop, 525, 24).fill('#15803d');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    doc.text('#', 45, tableTop + 7, { width: 25 });
    doc.text('ITEM DESCRIPTION', 75, tableTop + 7, { width: 220 });
    doc.text('REF / DATE', 300, tableTop + 7, { width: 80 });
    doc.text('QTY', 385, tableTop + 7, { width: 35, align: 'center' });
    doc.text('UNIT RATE', 425, tableTop + 7, { width: 60, align: 'right' });
    doc.text('TOTAL', 490, tableTop + 7, { width: 60, align: 'right' });

    let currentY = tableTop + 24;
    const itemList = Array.isArray(items) && items.length > 0 ? items : [{
      item_name: bill.remarks || 'Subscription Daily Supply',
      reference_id: bill.reference_id || bill.bill_id,
      quantity: 1,
      unit_price: bill.total_amount,
      total_amount: bill.total_amount,
    }];

    itemList.forEach((item: any, idx: number) => {
      const isEven = idx % 2 === 0;
      doc.rect(35, currentY, 525, 22).fill(isEven ? '#ffffff' : '#f8fafc');
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
      doc.text(String(idx + 1), 45, currentY + 6, { width: 25 });
      doc.font('Helvetica-Bold').text(String(item.item_name || item.product_name || 'Produce Item').slice(0, 35), 75, currentY + 6, { width: 220 });
      doc.font('Helvetica').text(String(item.reference_id || item.scheduled_date || '—').slice(0, 15), 300, currentY + 6, { width: 80 });
      doc.text(String(item.quantity || 1), 385, currentY + 6, { width: 35, align: 'center' });
      doc.text(`₹${Number(item.unit_price || 0).toFixed(2)}`, 425, currentY + 6, { width: 60, align: 'right' });
      doc.font('Helvetica-Bold').text(`₹${Number(item.total_amount || 0).toFixed(2)}`, 490, currentY + 6, { width: 60, align: 'right' });
      currentY += 22;
    });

    // Summary Box
    currentY += 10;
    doc.rect(320, currentY, 240, 95).fillAndStroke('#f8fafc', '#e2e8f0');

    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text('Subtotal:', 330, currentY + 8);
    doc.text(`₹${Number(bill.subtotal || bill.total_amount || 0).toFixed(2)}`, 450, currentY + 8, { width: 100, align: 'right' });

    doc.text('Discount:', 330, currentY + 22);
    doc.text(`-₹${Number(bill.discount_amount || 0).toFixed(2)}`, 450, currentY + 22, { width: 100, align: 'right' });

    doc.text('Tax / GST:', 330, currentY + 36);
    doc.text(`₹${Number(bill.tax_amount || 0).toFixed(2)}`, 450, currentY + 36, { width: 100, align: 'right' });

    doc.rect(330, currentY + 50, 220, 1).fill('#cbd5e1');

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
    doc.text('Grand Total:', 330, currentY + 56);
    doc.text(`₹${Number(bill.total_amount || 0).toFixed(2)}`, 450, currentY + 56, { width: 100, align: 'right' });

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#16a34a');
    doc.text('Paid Amount:', 330, currentY + 74);
    doc.text(`₹${Number(bill.paid_amount || 0).toFixed(2)}`, 450, currentY + 74, { width: 100, align: 'right' });

    // Footer note
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('This is a computer-generated tax invoice receipt from F2H Fresh. Support: support@f2hfresh.com | +91 9876543210', 35, 780, { align: 'center', width: 525 });

    doc.end();

    const buffer = await new Promise<Buffer>((resolve) => {
      stream.on('finish', () => resolve(Buffer.concat(chunks)));
    });

    return {
      buffer,
      filename: `tax-invoice-${bill.bill_id || id}.pdf`,
    };
  }

  async getBranches(): Promise<any> {
    const branches = await this.repository.getBranches();
    return {
      status: true,
      data: branches,
    };
  }
}
