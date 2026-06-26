import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';
import { getGraphData } from './user/graph';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const dbClient = await pool.connect();
  try {
    const data = await getGraphData('', 'admin', dbClient);
    
    // 寻找 EGLO 报告节点
    const egloNode = data.nodes.find((n: any) => n.title.includes('EGLO'));

    // 寻找 OBI 报告与 EGLO 报告之间的连线
    const reportMap = new Map();
    data.nodes.forEach((n: any) => reportMap.set(n.id, n));

    const targetedLinks = data.links.map((link: any) => {
      const srcNode = reportMap.get(link.source);
      const tgtNode = reportMap.get(link.target);
      return {
        sourceTitle: srcNode ? srcNode.title : 'Unknown',
        targetTitle: tgtNode ? tgtNode.title : 'Unknown',
        relationType: link.relation_type,
        relationKey: link.relation_key
      };
    });

    return res.status(200).json({
      egloNodeDetail: egloNode ? {
        title: egloNode.title,
        companies: egloNode.companies,
        competitors: egloNode.competitors,
        products: egloNode.products,
        channels: egloNode.channels
      } : null,
      links: targetedLinks.filter((l: any) => 
        (l.sourceTitle.includes('EGLO') && l.targetTitle.includes('OBI')) ||
        (l.sourceTitle.includes('OBI') && l.targetTitle.includes('EGLO'))
      )
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
