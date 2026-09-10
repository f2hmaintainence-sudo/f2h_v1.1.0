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

  async getAllCustomerBills(query: any): Promise<any> {
    const res = await this.repository.getAllCustomerBills(query);
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

  async getBillingStats(days = 30): Promise<any> {
    const stats = await this.repository.getBillingStats(days);
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
    const bodyText = customMessage || `Dear ${bill.customer_name || 'Customer'}, your subscription bill #${bill.bill_number || bill.id} of ${dueAmountStr} is pending (Due: ${dueDateStr}). Please tap to view and pay your bill.`;

    await this.pushNotificationService.sendNotificationToUsers(
      [bill.customer_id],
      {
        title: '🔔 Subscription Bill Payment Due',
        body: bodyText,
        data: {
          type: 'customer_bills',
          route: '/customer_bills',
          bill_id: String(bill.bill_number || bill.id || ''),
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
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
      const cleanIds = billIds.map(id => String(id || '').replace(/^[#\s]+|[#\s]+$/g, '').trim()).filter(Boolean);
      targetBills = await this.repository.findBillsByIds(cleanIds);
    } else {
      const res = await this.repository.getSubscriberOutstandingBills({
        status: overdueOnly ? 'overdue' : undefined,
        limit: 5000,
      });
      targetBills = res.bills || [];
    }

    if (targetBills.length === 0) {
      return {
        status: true,
        sentCount: 0,
        message: 'No pending subscriber bills found to intimate.',
      };
    }

    let sentCount = 0;
    const notifiedCustomers = new Set<string>();

    for (const bill of targetBills) {
      if (!bill.customer_id || notifiedCustomers.has(bill.customer_id)) continue;
      const dueAmountStr = `₹${Number(bill.due_amount || bill.total_amount || 0).toFixed(2)}`;
      const dueDateStr = bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'immediate';
      const bodyText = customMessage || `Dear ${bill.customer_name || 'Customer'}, your pending subscription bill #${bill.bill_number || bill.id} of ${dueAmountStr} is awaiting payment (Due: ${dueDateStr}). Please tap to pay now.`;

      await this.pushNotificationService.sendNotificationToUsers(
        [bill.customer_id],
        {
          title: '🔔 Subscription Bill Payment Due',
          body: bodyText,
          data: {
            type: 'customer_bills',
            route: '/customer_bills',
            bill_id: String(bill.bill_number || bill.id || ''),
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
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
    const [data, company] = await Promise.all([
      this.repository.getBillReceipt(id),
      this.repository.getCompanyProfile(),
    ]);
    if (!data) {
      throw new NotFoundException(`Invoice receipt ${id} not found.`);
    }
    if (requesterCustomerId && data.bill?.customer_id !== requesterCustomerId) {
      // Reported as "not found" rather than "forbidden" so the response does not
      // confirm that a bill with this id exists.
      throw new NotFoundException(`Invoice receipt ${id} not found.`);
    }
    data.company = company || {
      name: 'F2H FRESH',
      legal_name: 'MURALI',
      gst_number: '29CXKPM2351R1ZN',
      pan_number: 'CXKPM2351R',
    };
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
    const { bill, items, company } = res.data;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit');
    const { PassThrough } = require('stream');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 28, bottom: 28, left: 32, right: 32 },
      bufferPages: true,
      autoFirstPage: true,
    });

    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.pipe(stream);

    const fmtMoney = (amt: any) => `Rs. ${Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d: any) => {
      if (!d) return '—';
      try {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return String(d);
      }
    };

    const isPaid = (bill.status || '').toLowerCase() === 'paid';
    const dueAmount = Number(bill.due_amount || 0);

    // -------------------------------------------------------------
    // TOP HEADER BAR (Modern Brand & Official Badge)
    // -------------------------------------------------------------
    doc.rect(32, 28, 531, 62).fill('#064e3b'); // Dark Forest Emerald

    // Brand Name
    const brandName = String(company?.name || 'F2H FRESH').toUpperCase();
    const gstin = String(company?.gst_number || '29CXKPM2351R1ZN').trim();
    const pan = String(company?.pan_number || 'CXKPM2351R').trim();

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text(brandName, 46, 38);
    doc.font('Helvetica').fontSize(8.5).fillColor('#a7f3d0').text('Farm to Home Supply & Subscription Services', 46, 59);

    const taxMetaParts: string[] = [];
    if (gstin) taxMetaParts.push(`GSTIN: ${gstin}`);
    if (pan) taxMetaParts.push(`PAN: ${pan}`);
    const taxMeta = taxMetaParts.length > 0 ? taxMetaParts.join('  •  ') : 'GSTIN: 29CXKPM2351R1ZN  •  PAN: CXKPM2351R';
    doc.font('Helvetica').fontSize(7.5).fillColor('#d1fae5').text(taxMeta, 46, 70);

    // Right Side: Tax Invoice Title
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#ffffff').text('TAX INVOICE', 350, 40, { width: 200, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#6ee7b7').text(`INVOICE: #${bill.bill_number || bill.bill_id || id}`, 350, 58, { width: 200, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('#e2e8f0').text(`Date: ${fmtDate(bill.created_at || Date.now())}`, 350, 70, { width: 200, align: 'right' });

    // -------------------------------------------------------------
    // BILLED TO & INVOICE METADATA (Two-card layout)
    // -------------------------------------------------------------
    const cardY = 98;
    const cardH = 88;

    // Card 1: Billed Customer
    doc.roundedRect(32, cardY, 260, cardH, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('BILLED TO:', 42, cardY + 8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#047857').text(String(bill.customer_name || 'Customer').slice(0, 32), 42, cardY + 22);
    
    doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
    doc.text(`Phone: ${bill.customer_phone || '—'}`, 42, cardY + 38);
    doc.text(`Email: ${bill.customer_email || '—'}`, 42, cardY + 50);
    const addr = String(bill.customer_address || 'Registered Delivery Address').trim();
    doc.text(`Address: ${addr.length > 40 ? addr.slice(0, 37) + '...' : addr}`, 42, cardY + 62, { width: 240 });

    // Card 2: Invoice & Payment Details
    doc.roundedRect(303, cardY, 260, cardH, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('PAYMENT DETAILS:', 315, cardY + 8);

    doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
    doc.text('Bill Type:', 315, cardY + 24);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(String(bill.bill_type || 'Subscription').toUpperCase(), 410, cardY + 24, { width: 145, align: 'right' });

    doc.font('Helvetica').fillColor('#475569').text('Payment Mode:', 315, cardY + 38);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(String(bill.payment_method || 'WALLET').toUpperCase(), 410, cardY + 38, { width: 145, align: 'right' });

    doc.font('Helvetica').fillColor('#475569').text('Due Date:', 315, cardY + 52);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(fmtDate(bill.due_date), 410, cardY + 52, { width: 145, align: 'right' });

    doc.font('Helvetica').fillColor('#475569').text('Payment Status:', 315, cardY + 66);
    doc.font('Helvetica-Bold').fillColor(isPaid ? '#059669' : '#dc2626').text(isPaid ? 'PAID' : (dueAmount > 0 ? `DUE (${fmtMoney(dueAmount)})` : 'PENDING'), 410, cardY + 66, { width: 145, align: 'right' });

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // LINE ITEMS TABLE HEADER
    // -------------------------------------------------------------
    const tableTop = 196;
    doc.roundedRect(32, tableTop, 531, 24, 4).fill('#047857'); // Emerald header

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    doc.text('SL', 40, tableTop + 7, { width: 25 });
    doc.text('ITEM / PRODUCE', 75, tableTop + 7, { width: 305 });
    doc.text('QTY', 390, tableTop + 7, { width: 35, align: 'center' });
    doc.text('RATE', 430, tableTop + 7, { width: 60, align: 'right' });
    doc.text('TOTAL', 495, tableTop + 7, { width: 60, align: 'right' });

    let currentY = tableTop + 24;
    const itemList = Array.isArray(items) && items.length > 0 ? items : [{
      item_name: bill.remarks || 'Daily Fresh Produce / Subscription Supply',
      reference_id: bill.reference_id || bill.bill_id || 'F2H-ITEM',
      quantity: 1,
      unit_price: bill.total_amount,
      total_amount: bill.total_amount,
    }];

    itemList.forEach((item: any, idx: number) => {
      if (currentY > 670) {
        doc.addPage();
        currentY = 40;
      }

      const isEven = idx % 2 === 0;
      doc.rect(32, currentY, 531, 22).fill(isEven ? '#ffffff' : '#f8fafc');
      doc.rect(32, currentY + 21, 531, 0.5).fill('#e2e8f0');

      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(String(idx + 1), 40, currentY + 6, { width: 25 });

      // Item Description (Expanded width since Delivery Date & Slot is removed)
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
      const itemName = String(item.item_name || item.product_name || 'Produce Item').trim();
      doc.text(itemName.length > 55 ? itemName.slice(0, 52) + '...' : itemName, 75, currentY + 6, { width: 305 });

      // Qty
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#334155');
      doc.text(String(item.quantity || 1), 390, currentY + 6, { width: 35, align: 'center' });

      // Rate
      doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
      doc.text(fmtMoney(item.unit_price || 0), 430, currentY + 6, { width: 60, align: 'right' });

      // Total
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#047857');
      doc.text(fmtMoney(item.total_amount || 0), 495, currentY + 6, { width: 60, align: 'right' });

      currentY += 22;
    });

    // -------------------------------------------------------------
    // TOTALS CALCULATION BOX
    // -------------------------------------------------------------
    currentY += 12;
    if (currentY > 640) {
      doc.addPage();
      currentY = 40;
    }

    const totalsX = 310;
    const totalsW = 253;
    const totalsH = 114;

    // Left Box: Notes / Bank Details
    doc.roundedRect(32, currentY, 260, totalsH, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('TERMS & INSTRUCTIONS:', 42, currentY + 8);
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
    doc.text('• Farm fresh produce supplied in prime condition.', 42, currentY + 22, { width: 240 });
    const supportPhone = String(company?.phone || '+91 91487 73591').trim();
    doc.text(`• UPI ID: f2hfresh@icici  |  Phone: ${supportPhone}`, 42, currentY + 46, { width: 240 });
    doc.text('• Any discrepancy must be reported within 24 hours of delivery.', 42, currentY + 58, { width: 240 });

    const officeAddr = company?.address
      ? `${company.address}, ${company.city || ''} ${company.pincode || ''}`.trim()
      : 'NO.11, SJP Layout, 1st Cross, Nagondahalli, Whitefield, Bengaluru 560066';
    doc.font('Helvetica-Oblique').fontSize(6.8).fillColor('#94a3b8').text(`Reg. Office: ${officeAddr.length > 55 ? officeAddr.slice(0, 52) + '...' : officeAddr}`, 42, currentY + 76, { width: 240 });

    // Right Box: Financial Summary
    doc.roundedRect(totalsX, currentY, totalsW, totalsH, 6).fillAndStroke('#f8fafc', '#cbd5e1');

    const rawGrossSubtotal = itemList.reduce(
      (sum: number, it: any) => sum + (Number(it.unit_price || 0) * (Number(it.quantity) || 1)),
      0,
    );
    const itemDiscountsSum = itemList.reduce(
      (sum: number, it: any) => sum + Number(it.discount_amount || 0),
      0,
    );
    const grandTotalVal = Number(bill.total_amount || 0);

    const discountVal = Math.max(
      Number(bill.discount_amount || 0),
      itemDiscountsSum,
      Math.max(0, rawGrossSubtotal - grandTotalVal),
    );

    const subTotalVal = Math.max(
      rawGrossSubtotal,
      Number(bill.subtotal || 0),
      grandTotalVal + discountVal,
    );

    const taxVal = Number(bill.tax_amount || 0);
    const paidVal = Number(bill.paid_amount || 0);
    const dueVal = Number(bill.due_amount || 0);

    let totY = currentY + 8;

    // Subtotal Row
    doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
    doc.text('Subtotal:', totalsX + 12, totY);
    doc.text(fmtMoney(subTotalVal), totalsX + 130, totY, { width: 110, align: 'right' });
    totY += 13;

    // Discount / Savings Row (Always displayed)
    if (discountVal > 0) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#059669');
      doc.text('Discount / Savings:', totalsX + 12, totY);
      doc.text(`-${fmtMoney(discountVal)}`, totalsX + 130, totY, { width: 110, align: 'right' });
      totY += 13;
    } else {
      doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
      doc.text('Discounts & Offers:', totalsX + 12, totY);
      doc.text('Rs. 0.00', totalsX + 130, totY, { width: 110, align: 'right' });
      totY += 13;
    }

    // Taxes Row
    if (taxVal > 0) {
      doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
      doc.text('Taxes & GST (Included):', totalsX + 12, totY);
      doc.text(`+${fmtMoney(taxVal)}`, totalsX + 130, totY, { width: 110, align: 'right' });
      totY += 13;
    }

    // Divider line
    totY += 1;
    doc.rect(totalsX + 12, totY, totalsW - 24, 0.75).fill('#cbd5e1');
    totY += 5;

    // Grand Total Row
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a');
    doc.text('Grand Total:', totalsX + 12, totY);
    doc.text(fmtMoney(grandTotalVal), totalsX + 110, totY, { width: 130, align: 'right' });
    totY += 16;

    // Paid Row
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#059669');
    doc.text('Amount Paid:', totalsX + 12, totY);
    doc.text(fmtMoney(paidVal), totalsX + 130, totY, { width: 110, align: 'right' });
    totY += 13;

    // Due Row
    doc.font('Helvetica-Bold').fontSize(9).fillColor(dueVal > 0 ? '#dc2626' : '#64748b');
    doc.text('Balance Due:', totalsX + 12, totY);
    doc.text(fmtMoney(dueVal), totalsX + 130, totY, { width: 110, align: 'right' });

    // -------------------------------------------------------------
    // FOOTER (Page numbers & computer-generated note)
    // -------------------------------------------------------------
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.rect(32, 800, 531, 0.5).fill('#e2e8f0');
      doc.font('Helvetica').fontSize(7.5).fillColor('#94a3b8');
      doc.text('This is a computer-generated tax invoice and requires no physical signature. Support: support@f2hfresh.com  •  www.f2hfresh.com', 32, 808, { width: 400, align: 'left' });
      doc.text(`Page ${i + 1} of ${pageCount}`, 430, 808, { width: 133, align: 'right' });
    }

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
