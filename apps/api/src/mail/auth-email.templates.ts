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

export const welcomeWithPasswordTemplate = (name: string, email: string, password: string) => ({
  subject: 'Welcome to F2H Fresh — Your Login Credentials',
  text: `Welcome to F2H Fresh, ${name}. Your account is ready.\n\nLogin Details:\nEmail: ${email}\nPassword: ${password}\n\nYou can log in anytime using this password or sign in with OTP.`,
  html: shell(
    'Welcome to F2H Fresh 🎉',
    `<p>Hi <strong>${name}</strong>,</p>
     <p>Your account has been created successfully! You can now explore fresh farm milk and daily essentials delivered directly to your doorstep.</p>
     <div style="margin: 20px 0; padding: 18px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
       <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534; font-size: 15px;">Your Account Login Details:</p>
       <p style="margin: 6px 0; font-size: 14px;"><strong>Email:</strong> <span style="color: #374151;">${email}</span></p>
       <p style="margin: 6px 0; font-size: 14px;"><strong>Password:</strong> <code style="background: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 16px; font-weight: bold; color: #15803d; border: 1px solid #dcfce7;">${password}</code></p>
     </div>
     <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">You can log in anytime using your email and password, or use OTP login with your registered mobile number. You can also update your password anytime from your profile settings.</p>`,
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
