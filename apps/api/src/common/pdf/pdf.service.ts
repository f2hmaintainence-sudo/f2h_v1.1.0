import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');
import { PassThrough } from 'stream';

/**
 * Reusable PDF Service
 *
 * Generates dynamic PDF reports from structured data.
 * Can be injected into any NestJS module/service.
 *
 * Usage:
 *   const buffer = await pdfService.generateReport({ ... });
 */

export interface PdfColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown) => string;
}

export interface PdfSummaryCard {
  label: string;
  value: string | number;
  color?: string;
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  summaryCards?: PdfSummaryCard[];
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  footer?: string;
  orientation?: 'portrait' | 'landscape';
}

@Injectable()
export class PdfService {
  /**
   * Generates a PDF report and returns it as a Buffer.
   */
  async generateReport(options: PdfReportOptions): Promise<Buffer> {
    const {
      title,
      subtitle,
      generatedAt,
      summaryCards,
      columns,
      rows,
      footer,
      orientation = 'landscape',
    } = options;

    const doc = new PDFDocument({
      size: 'A4',
      layout: orientation,
      margins: { top: 40, bottom: 40, left: 30, right: 30 },
      bufferPages: true,
    });

    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.pipe(stream);

    const pageWidth =
      orientation === 'landscape' ? 842 - 60 : 595 - 60; // A4 dimensions minus margins

    // ── Brand header ──
    doc
      .rect(0, 0, orientation === 'landscape' ? 842 : 595, 80)
      .fill('#1a5632');

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#ffffff')
      .text(title, 30, 22, { width: pageWidth });

    if (subtitle) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#c8e6c9')
        .text(subtitle, 30, 48, { width: pageWidth });
    }

    if (generatedAt) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#c8e6c9')
        .text(`Generated: ${generatedAt}`, 30, 62, {
          width: pageWidth,
          align: 'right',
        });
    }

    let y = 95;

    // ── Summary cards ──
    if (summaryCards && summaryCards.length > 0) {
      const cardWidth = Math.min(
        120,
        (pageWidth - (summaryCards.length - 1) * 8) / summaryCards.length,
      );
      const startX = 30;

      for (let i = 0; i < summaryCards.length; i++) {
        const card = summaryCards[i];
        const cx = startX + i * (cardWidth + 8);

        // card background
        doc
          .roundedRect(cx, y, cardWidth, 48, 4)
          .fill(card.color || '#f0fdf4');

        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#6b7280')
          .text(card.label, cx + 6, y + 6, {
            width: cardWidth - 12,
            align: 'center',
          });

        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor('#1a5632')
          .text(String(card.value), cx + 6, y + 22, {
            width: cardWidth - 12,
            align: 'center',
          });
      }

      y += 62;
    }

    // ── Table ──
    const totalDefinedWidth = columns.reduce(
      (sum, col) => sum + (col.width || 0),
      0,
    );
    const unsetCount = columns.filter((c) => !c.width).length;
    const remainingWidth = pageWidth - totalDefinedWidth;
    const autoWidth = unsetCount > 0 ? remainingWidth / unsetCount : 80;

    const resolvedColumns = columns.map((col) => ({
      ...col,
      width: col.width || autoWidth,
    }));

    // Table header
    const headerHeight = 22;
    doc
      .rect(30, y, pageWidth, headerHeight)
      .fill('#e8f5e9');

    let hx = 30;
    for (const col of resolvedColumns) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#1a5632')
        .text(col.header, hx + 4, y + 6, {
          width: col.width - 8,
          align: (col.align as 'left' | 'center' | 'right') || 'left',
        });
      hx += col.width;
    }
    y += headerHeight;

    // Table rows
    const rowHeight = 20;
    for (let ri = 0; ri < rows.length; ri++) {
      // Check for page break
      if (y + rowHeight > doc.page.height - 60) {
        doc.addPage();
        y = 40;

        // Re-draw header on new page
        doc
          .rect(30, y, pageWidth, headerHeight)
          .fill('#e8f5e9');

        let rhx = 30;
        for (const col of resolvedColumns) {
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#1a5632')
            .text(col.header, rhx + 4, y + 6, {
              width: col.width - 8,
              align: (col.align as 'left' | 'center' | 'right') || 'left',
            });
          rhx += col.width;
        }
        y += headerHeight;
      }

      // Alternating row bg
      if (ri % 2 === 0) {
        doc
          .rect(30, y, pageWidth, rowHeight)
          .fill('#fafafa');
      }

      let rx = 30;
      for (const col of resolvedColumns) {
        const raw = rows[ri][col.key];
        const text = col.format ? col.format(raw) : String(raw ?? '-');

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#374151')
          .text(text, rx + 4, y + 5, {
            width: col.width - 8,
            align: (col.align as 'left' | 'center' | 'right') || 'left',
            lineBreak: false,
          });
        rx += col.width;
      }
      y += rowHeight;
    }

    // ── Footer ──
    y += 16;
    if (footer) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#6b7280')
        .text(footer, 30, y, { width: pageWidth, align: 'center' });
    }

    // Page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#9ca3af')
        .text(
          `Page ${i + 1} of ${totalPages}`,
          30,
          doc.page.height - 30,
          { width: pageWidth, align: 'center' },
        );
    }

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
