import { NextApiRequest, NextApiResponse } from 'next';

// 多币种结汇静态兜底汇率（防止公共 API 宕机导致测试失败）
const BACKUP_RATES: Record<string, number> = {
  USD: 7.24,
  EUR: 7.85,
  GBP: 9.18,
  JPY: 0.046,
  HKD: 0.92,
};

// 提取实时汇率逻辑 (具备超时和容错降级机制)
export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    // 尝试调用极速的免费汇率 API，设置 1.5 秒超时
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1500);

    const response = await fetch('https://open.er-api.com/v6/latest/CNY', {
      signal: controller.signal
    });
    
    clearTimeout(id);

    if (!response.ok) throw new Error('API 响应异常');

    const data = await response.json();
    
    // er-api 返回的是以 CNY 为基准的兑其他货币的值，我们需要求倒数换算为 1外币 = 多少CNY
    if (data && data.rates) {
      const rates: Record<string, number> = {};
      Object.keys(BACKUP_RATES).forEach(currency => {
        if (data.rates[currency]) {
          // 汇率换算，保留四位小数
          rates[currency] = parseFloat((1 / data.rates[currency]).toFixed(4));
        } else {
          rates[currency] = BACKUP_RATES[currency];
        }
      });
      return rates;
    }
    
    return BACKUP_RATES;
  } catch (err) {
    // 容错降级：打印警告日志，并返回本地最新备份汇率
    console.warn('实时汇率 API 访问超时或出错，已自动降级使用本地缓存汇率。');
    return BACKUP_RATES;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rates = await getExchangeRates();
    return res.status(200).json({ success: true, rates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
