import { ProfileService } from './profile.service';

describe('ProfileService company profile', () => {
  it('locks and mirrors a company update inside one transaction', async () => {
    const profile = {
      id: 'company-1',
      name: 'F2H Fresh',
      legal_name: '',
      gst_number: '',
      pan_number: '',
      email: 'support@f2hfresh.com',
      phone: '+91 91487 73591',
      secondary_phone: '',
      whatsapp: '+91 91487 73591',
      address: '10 Market Road',
      city: 'Kuppam',
      state: 'Andhra Pradesh',
      pincode: '517425',
      logo_url: '',
      website: 'https://f2hfresh.com',
      instagram_url: '',
      facebook_url: '',
      youtube_url: '',
      created_at: new Date('2026-08-20T00:00:00Z'),
      updated_at: new Date('2026-08-20T00:00:00Z'),
    };
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('SELECT id')) return { rows: [{ id: profile.id }] };
        if (sql.includes('UPDATE company_profile')) return { rows: [profile] };
        if (sql.includes('INSERT INTO site_settings')) return { rows: [] };
        throw new Error('Unexpected SQL in test');
      }),
    };
    const db = {
      query: jest.fn(),
      transaction: jest.fn(
        async (callback: (value: typeof client) => unknown) => callback(client),
      ),
    };
    const developer = { error: jest.fn() };
    const service = new ProfileService(
      db as never,
      developer as never,
      {} as never,
    );

    const result = await service.updateCompanyProfile({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      pincode: profile.pincode,
      website: profile.website,
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(client.query.mock.calls[1][0]).toContain('SELECT id');
    expect(client.query.mock.calls[2][0]).toContain('UPDATE company_profile');
    expect(client.query.mock.calls[3][0]).toContain(
      'INSERT INTO site_settings',
    );
    expect(client.query.mock.calls[3][1]).toEqual(
      expect.arrayContaining([
        'company_name',
        'F2H Fresh',
        'phone_url',
        'tel:+919148773591',
        'whatsapp_url',
        'https://wa.me/919148773591',
      ]),
    );
    expect(result).toMatchObject({
      status: true,
      data: { id: 'company-1', name: 'F2H Fresh' },
    });
    expect(developer.error).not.toHaveBeenCalled();
  });
});
