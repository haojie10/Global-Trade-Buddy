import type { NextApiRequest, NextApiResponse } from 'next';
import dns from 'dns';
import { updateContactVerifyStatus } from '../../../lib/crm-service';

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: '缺少有效的邮箱参数' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. 语法检查
  if (!EMAIL_REGEX.test(cleanEmail)) {
    await updateContactVerifyStatus(cleanEmail, 'invalid', 'syntax_checker');
    return res.status(200).json({
      success: true,
      email: cleanEmail,
      status: 'invalid',
      reason: '邮箱格式不符合 RFC 规范',
    });
  }

  const domain = cleanEmail.split('@')[1];

  // 2. DNS MX 记录真实解析
  try {
    const mxRecords = await dns.promises.resolveMx(domain);

    if (!mxRecords || mxRecords.length === 0) {
      await updateContactVerifyStatus(cleanEmail, 'invalid', 'dns_mx_checker');
      return res.status(200).json({
        success: true,
        email: cleanEmail,
        status: 'invalid',
        reason: '该企业域名未配置任何邮件交换 (MX) 记录，无法收信',
      });
    }

    // 按优先级排序 MX 记录
    mxRecords.sort((a, b) => a.priority - b.priority);
    const primaryMx = mxRecords[0].exchange;

    // 3. 第三方商业 API 插槽 (若未来配置了 API KEY 则自动优先调用)
    const verifierApiKey = process.env.EMAIL_VERIFIER_API_KEY || process.env.ZEROBOUNCE_API_KEY;
    if (verifierApiKey) {
      try {
        // 预留 ZeroBounce / MillionVerifier 等 API 接入
        // const apiRes = await fetch(...)
      } catch (e) {
        console.warn('[Verify API] 第三方 API 调用失败，自动降级为本地 MX 认证', e);
      }
    }

    // 4. 更新数据库验证状态为有效
    await updateContactVerifyStatus(cleanEmail, 'valid', `dns_mx:${primaryMx}`);

    return res.status(200).json({
      success: true,
      email: cleanEmail,
      status: 'valid',
      primaryMx,
      verifiedAt: new Date().toISOString(),
    });
  } catch (dnsErr: any) {
    console.warn(`[Verify API] 域名 ${domain} MX 解析失败:`, dnsErr.code || dnsErr.message);

    const isNotFound = dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'ENODATA';
    const newStatus = isNotFound ? 'invalid' : 'unverified';
    
    if (isNotFound) {
      await updateContactVerifyStatus(cleanEmail, 'invalid', 'dns_mx_checker');
    }

    return res.status(200).json({
      success: true,
      email: cleanEmail,
      status: newStatus,
      reason: isNotFound ? '域名不存在或已注销' : 'DNS 查询超时，请稍后重试',
    });
  }
}
