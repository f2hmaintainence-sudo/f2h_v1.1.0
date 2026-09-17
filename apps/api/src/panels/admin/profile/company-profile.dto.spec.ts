import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCompanyProfileDto } from './company-profile.dto';

describe('UpdateCompanyProfileDto', () => {
  it('trims and accepts a valid complete profile', async () => {
    const dto = plainToInstance(UpdateCompanyProfileDto, {
      name: '  F2H Fresh  ',
      email: ' support@f2hfresh.com ',
      phone: '+91 91487 73591',
      secondary_phone: '',
      whatsapp: '+91 91487 73591',
      website: 'https://f2hfresh.com',
      logo_url: '',
      instagram_url: 'https://instagram.com/f2hfresh',
      linkedin_url: 'https://linkedin.com/company/f2hfresh',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.name).toBe('F2H Fresh');
    expect(dto.email).toBe('support@f2hfresh.com');
    expect(dto.linkedin_url).toBe('https://linkedin.com/company/f2hfresh');
  });

  it('rejects missing names and unsafe public contact values', async () => {
    const dto = plainToInstance(UpdateCompanyProfileDto, {
      name: ' ',
      email: 'not-an-email',
      phone: 'call-me',
      website: 'javascript:alert(1)',
      linkedin_url: 'javascript:alert(1)',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'email', 'phone', 'website', 'linkedin_url']),
    );
  });
});
