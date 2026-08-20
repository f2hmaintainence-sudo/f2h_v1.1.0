import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditLogQueryDto } from './admin-system.dto';

describe('AuditLogQueryDto', () => {
  it('rejects impossible dates and values above pagination limits', async () => {
    const query = plainToInstance(AuditLogQueryDto, {
      from_date: '2026-02-30',
      page: '10001',
      limit: '101',
      include_filter_options: 'yes',
    });

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'from_date',
        'page',
        'limit',
        'include_filter_options',
      ]),
    );
  });

  it('rejects pagination values below one', async () => {
    const query = plainToInstance(AuditLogQueryDto, {
      page: '0',
      limit: '0',
    });

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'limit']),
    );
  });

  it('transforms and accepts valid boundary values', async () => {
    const query = plainToInstance(AuditLogQueryDto, {
      from_date: '2024-02-29',
      to_date: '2026-08-20',
      page: '10000',
      limit: '100',
      include_filter_options: 'false',
    });

    const errors = await validate(query);

    expect(errors).toEqual([]);
    expect(query.page).toBe(10000);
    expect(query.limit).toBe(100);
    expect(query.include_filter_options).toBe('false');
  });
});
