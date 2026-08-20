import {
  buildEditableCompanyProfile,
  buildPublicCompanyProfile,
  parseSiteSettings,
} from './company-profile';

describe('company profile projections', () => {
  it('uses canonical public fields, formats the address, and omits legal data', () => {
    const data = buildPublicCompanyProfile(
      {
        name: 'F2H Fresh Foods',
        legal_name: 'Private legal name',
        gst_number: 'SECRET-GST',
        pan_number: 'SECRET-PAN',
        phone: '+91 91487 73591',
        whatsapp: '',
        address: '10 Market Road',
        city: 'Kuppam',
        state: 'Andhra Pradesh',
        pincode: '517425',
        website: 'https://f2hfresh.com',
      },
      {
        company_name: 'Legacy name',
        phone: '+91 00000 00000',
      },
    );

    expect(data).toMatchObject({
      company_name: 'F2H Fresh Foods',
      phone: '+91 91487 73591',
      phone_url: 'tel:+919148773591',
      whatsapp: '+91 91487 73591',
      whatsapp_url: 'https://wa.me/919148773591',
      address: '10 Market Road, Kuppam, Andhra Pradesh, 517425',
    });
    expect(data).not.toHaveProperty('legal_name');
    expect(data).not.toHaveProperty('gst_number');
    expect(data).not.toHaveProperty('pan_number');
  });

  it('keeps safe legacy link fallbacks and rejects unsafe schemes', () => {
    const legacy = parseSiteSettings([
      { key: 'company_name', value: 'F2H Fresh' },
      { key: 'phone_url', value: 'tel:+919148773591' },
      { key: 'whatsapp_url', value: 'https://wa.me/919148773591' },
      { key: 'instagram_url', value: 'javascript:alert(1)' },
    ]);
    const data = buildPublicCompanyProfile(null, legacy);

    expect(data.phone_url).toBe('tel:+919148773591');
    expect(data.whatsapp_url).toBe('https://wa.me/919148773591');
    expect(data.instagram_url).toBe('');
  });

  it('returns a stable editable shape when no canonical row exists', () => {
    const data = buildEditableCompanyProfile(null, {
      email: 'legacy@f2hfresh.com',
    });

    expect(data).toMatchObject({
      id: '',
      name: 'F2H Fresh',
      email: 'legacy@f2hfresh.com',
      phone: '',
      whatsapp: '',
      legal_name: '',
    });
  });
});
