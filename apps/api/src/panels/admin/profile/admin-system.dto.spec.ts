import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditLogQueryDto } from './admin-system.dto';

describe('AuditLogQueryDto', () => {
  it('rejects invalid dates and pagination outside the allowed bounds', async () => {
    const query = plainToInstance(AuditLogQueryDto, {
      from_date: '2026-99-40',
      page: '0',
      limit: '500',
    });

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['from_date', 'page', 'limit']),
    );
  });

  it('transforms valid pagination query strings into numbers', async () => {
    const query = plainToInstance(AuditLogQueryDto, {
      from_date: '2026-08-01',
      to_date: '2026-08-20',
      page: '2',
      limit: '25',
    });

    const errors = await validate(query);

    expect(errors).toEqual([]);
    expect(query.page).toBe(2);
    expect(query.limit).toBe(25);
  });
});
