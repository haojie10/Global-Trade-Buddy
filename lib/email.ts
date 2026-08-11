import nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(options: SendMailOptions): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[sendMail] 未配置 SMTP 环境变量，跳过实际邮件发送');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  const mailOptions = {
    from: `"GlobalTradeBuddy 外贸智友" <${user}>`,
    to: options.to,
    subject: options.subject,
    html: options.html
  };

  await transporter.sendMail(mailOptions);
  return true;
}
