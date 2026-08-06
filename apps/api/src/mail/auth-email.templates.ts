const shell = (title: string, body: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="color: #166534;">${title}</h2>
    ${body}
    <p style="margin-top: 28px; color: #6b7280; font-size: 13px;">F2H Fresh</p>
  </div>
`;

const otpBlock = (otp: string) => `
  <div style="margin: 24px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; text-align: center;">
    <strong style="font-size: 32px; letter-spacing: 6px;">${otp}</strong>
  </div>
`;

export const registrationOtpTemplate = (otp: string) => ({
  subject: 'Your F2H Fresh registration OTP',
  text: `Your F2H Fresh registration OTP is ${otp}. It expires in 10 minutes.`,
  html: shell(
    'Verify your registration',
    `<p>Use this OTP to finish creating your F2H Fresh account.</p>
     ${otpBlock(otp)}
     <p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>`,
  ),
});

export const forgotPasswordOtpTemplate = (otp: string) => ({
  subject: 'Your F2H Fresh password reset OTP',
  text: `Your F2H Fresh password reset OTP is ${otp}. It expires in 10 minutes.`,
  html: shell(
    'Reset your password',
    `<p>Use this OTP to continue resetting your F2H Fresh password.</p>
     ${otpBlock(otp)}
     <p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>`,
  ),
});

export const welcomeEmailTemplate = (name: string) => ({
  subject: 'Welcome to F2H Fresh',
  text: `Welcome to F2H Fresh, ${name}. Your account is ready.`,
  html: shell(
    'Welcome to F2H Fresh',
    `<p>Hi ${name},</p><p>Your account is ready. You can now manage deliveries, addresses, and your wallet from the app.</p>`,
  ),
});

export const passwordChangedTemplate = () => ({
  subject: 'Your F2H Fresh password was changed',
  text: 'Your F2H Fresh password was changed. Contact support immediately if this was not you.',
  html: shell(
    'Password changed',
    '<p>Your password was changed successfully.</p><p>If this was not you, contact support immediately and secure your account.</p>',
  ),
});
