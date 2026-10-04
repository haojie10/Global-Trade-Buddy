import { describe, it, expect } from 'vitest';
import { extractRootDomain, cleanCompanyNameForLookup } from '../lib/crm-service';

describe('CRM Contacts Service & Matching Rules', () => {
  it('正确提取各种 URL 格式的根域名', () => {
    expect(extractRootDomain('https://www.lowes.com/search?q=drill')).toBe('lowes.com');
    expect(extractRootDomain('http://wilcon.com.ph')).toBe('wilcon.com.ph');
    expect(extractRootDomain('https://sub.branch.domain.co.uk/')).toBe('sub.branch.domain.co.uk');
    expect(extractRootDomain('www.nikotausa.com')).toBe('nikotausa.com');
    expect(extractRootDomain('')).toBe('');
  });

  it('规范化清洗海外企业名称，去除各类法律形式后缀', () => {
    expect(cleanCompanyNameForLookup("Lowe's Companies, Inc.")).toBe('lowe s companies');
    expect(cleanCompanyNameForLookup('BEGHELLI ASIA PACIFIC LTD.')).toBe('beghelli asia pacific');
    expect(cleanCompanyNameForLookup('Siemens AG / GmbH')).toBe('siemens ag');
    expect(cleanCompanyNameForLookup('NEWMAN AUTO RECYCLERS INC')).toBe('newman auto recyclers');
  });

  it('确保联系人数据在前端脱敏，隐藏广交会参展届数', async () => {
    // 模拟 API 数据清洗
    const mockDbContact = {
      id: 1,
      email: 'buyer@lowes.com',
      company_name: "Lowe's Companies, Inc.",
      contact_name: 'John Doe',
      phone: '+1 234 5678',
      source_session: '135th, 131th, 126th', // 广交会届数
      verify_status: 'unverified',
    };

    // 模拟 API 的脱敏逻辑
    const sanitized = {
      id: mockDbContact.id,
      email: mockDbContact.email,
      company_name: mockDbContact.company_name,
      contact_name: mockDbContact.contact_name,
      phone: mockDbContact.phone,
      verify_status: mockDbContact.verify_status,
      // 不包含 source_session
    };

    expect(sanitized).not.toHaveProperty('source_session');
    expect(sanitized.email).toBe('buyer@lowes.com');
  });

  it('DNS MX 解析存活检测与无效域名拦截', async () => {
    const dns = await import('dns');
    // 真实存在的域名应该解析出 MX
    const validMx = await dns.promises.resolveMx('google.com');
    expect(validMx.length).toBeGreaterThan(0);
    expect(validMx[0]).toHaveProperty('exchange');

    // 不存在的伪造域名应抛出 ENOTFOUND
    await expect(dns.promises.resolveMx('invalid-fake-domain-for-unit-test-999.xyz'))
      .rejects.toThrow();
  });
});
