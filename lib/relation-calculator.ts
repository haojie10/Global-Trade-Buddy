import { PoolClient } from 'pg';
import { RETAILER_ENTITIES } from './entity-constants';

/**
 * 校验两篇报告是否处于同一市场（或具备全球兜底能力）
 */
export function isSameMarket(marketA?: string | null, marketB?: string | null): boolean {
  const normA = (marketA || '全球').toLowerCase().trim();
  const normB = (marketB || '全球').toLowerCase().trim();

  // 若任意一方标记为全球，则视为市场有重合
  if (normA.includes('全球') || normA.includes('global') || normB.includes('全球') || normB.includes('global')) {
    return true;
  }

  const listA = normA.split(/[,，/]/).map(s => s.trim()).filter(Boolean);
  const listB = normB.split(/[,，/]/).map(s => s.trim()).filter(Boolean);

  // 判断是否有市场名交集
  return listA.some(m => listB.includes(m));
}

/**
 * 通用实体模糊/别称匹配
 */
function findEntityInReport(
  entsMap: Map<string, { role: string; canonical_name: string; entity_type?: string }>,
  targetEntityId: string,
  targetCanonicalName?: string
): { role: string; canonical_name: string; entity_type?: string } | null {
  if (targetEntityId && entsMap.has(targetEntityId)) {
    return entsMap.get(targetEntityId)!;
  }

  if (targetCanonicalName) {
    const nameLower = targetCanonicalName.toLowerCase().trim();
    for (const ent of entsMap.values()) {
      const canonicalLower = ent.canonical_name.toLowerCase().trim();
      if (canonicalLower === nameLower || canonicalLower.includes(nameLower) || nameLower.includes(canonicalLower)) {
        return ent;
      }
    }
  }

  return null;
}

export interface ReportEntityItem {
  role: string;
  canonical_name: string;
  entity_type?: string;
}

/**
 * 为单个报告重算与全库其它报告的关系连线并存入 relations 表
 */
export async function computeRelationsForReport(
  targetReportId: string,
  targetCategory: string,
  targetMarketRegion: string | null,
  currentEntMap: Map<string, ReportEntityItem>,
  primaryEntNameA: string,
  primaryEntityIdA: string | null,
  dbClient: PoolClient
) {
  // 1. 删除与当前报告相关的旧关系
  await dbClient.query('DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1', [targetReportId]);

  // 2. 读取全库其它报告及其主体
  const otherReportsRes = await dbClient.query(
    `SELECT r.id AS b_report_id, r.title AS b_title, r.category AS b_category, r.market_region AS b_market_region,
            r.primary_entity_id AS b_primary_id, e.canonical_name AS b_primary_name
     FROM reports r
     LEFT JOIN entities e ON r.primary_entity_id = e.id
     WHERE r.id != $1`,
    [targetReportId]
  );

  const otherReportIds = otherReportsRes.rows.map(r => r.b_report_id);
  if (otherReportIds.length === 0) return;

  // 3. 读取其它报告的所有实体
  const otherEntsRes = await dbClient.query(
    `SELECT re.report_id, re.entity_id, re.role, e.canonical_name, e.entity_type
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id
     WHERE re.report_id = ANY($1)`,
    [otherReportIds]
  );

  const otherRepEntMap = new Map<string, Map<string, ReportEntityItem>>();
  for (const row of otherEntsRes.rows) {
    if (!otherRepEntMap.has(row.report_id)) {
      otherRepEntMap.set(row.report_id, new Map());
    }
    otherRepEntMap.get(row.report_id)!.set(row.entity_id, {
      role: row.role,
      canonical_name: row.canonical_name,
      entity_type: row.entity_type
    });
  }

  // 4. 遍历与其它报告进行关系判断
  for (const otherRep of otherReportsRes.rows) {
    const bReportId = otherRep.b_report_id;
    const bCategory = otherRep.b_category;
    const bMarketRegion = otherRep.b_market_region;
    const bPrimaryId = otherRep.b_primary_id;
    const bPrimaryName = otherRep.b_primary_name ? otherRep.b_primary_name.toLowerCase().trim() : '';

    const entMapB = otherRepEntMap.get(bReportId) || new Map();

    let finalRelType: string | null = null;
    let finalRelKey: string = '';
    let sourceReportId = targetReportId;
    let targetReportIdCol = bReportId;

    const inSameMarket = isSameMarket(targetMarketRegion, bMarketRegion);

    // ==========================================
    // 分支一：品类报告 VS 品类报告
    // ==========================================
    if (targetCategory === 'product' && bCategory === 'product') {
      if (inSameMarket) {
        // 共享任意 company / competitor / channel 物理实体即构成“涉及关系”
        const sharedCompany = Array.from(currentEntMap.entries()).some(([entIdA, dataA]) => {
          if (['company', 'competitor', 'channel'].includes(dataA.entity_type || '')) {
            return entMapB.has(entIdA);
          }
          return false;
        });

        if (sharedCompany) {
          finalRelType = 'mention';
          finalRelKey = '涉及关系';
          if (targetReportId > bReportId) {
            sourceReportId = bReportId;
            targetReportIdCol = targetReportId;
          }
        }
      }
    }
    // ==========================================
    // 分支二：品类报告 VS 公司报告
    // ==========================================
    else if (
      (targetCategory === 'product' && bCategory === 'customer') ||
      (targetCategory === 'customer' && bCategory === 'product')
    ) {
      const prodCategoryReportId = targetCategory === 'product' ? targetReportId : bReportId;
      const custReportId = targetCategory === 'customer' ? targetReportId : bReportId;
      const entsProd = targetCategory === 'product' ? currentEntMap : entMapB;
      const entsCust = targetCategory === 'customer' ? currentEntMap : entMapB;
      const custPrimaryName = targetCategory === 'customer' ? primaryEntNameA : bPrimaryName;
      const custPrimaryId = targetCategory === 'customer' ? primaryEntityIdA : bPrimaryId;

      // 优先级 1：经营关系 (operation) — 增加市场限制
      if (inSameMarket) {
        // 条件1: 品类报告关联的渠道或供应商与公司报告的主体一致
        let companyInProdAsChannelOrSupplier = false;
        if (custPrimaryId) {
          const matchInProd = findEntityInReport(entsProd, custPrimaryId, custPrimaryName);
          if (matchInProd && (matchInProd.role === 'channel' || matchInProd.role === 'supplier')) {
            companyInProdAsChannelOrSupplier = true;
          }
        }

        // 条件2: 公司报告的产品(role=product)与品类报告的主体一致
        let companyOperatesProduct = false;
        const prodPrimaryName = targetCategory === 'product' ? primaryEntNameA : bPrimaryName;
        const prodPrimaryId = targetCategory === 'product' ? primaryEntityIdA : bPrimaryId;
        if (prodPrimaryId || prodPrimaryName) {
          const matchInCust = findEntityInReport(entsCust, prodPrimaryId || '', prodPrimaryName);
          if (matchInCust && (matchInCust.role === 'product' || matchInCust.entity_type === 'product')) {
            companyOperatesProduct = true;
          }
        }

        if (companyInProdAsChannelOrSupplier || companyOperatesProduct) {
          finalRelType = 'operation';
          finalRelKey = '经营关系';
          sourceReportId = custReportId;
          targetReportIdCol = prodCategoryReportId;
        }
      }

      // 优先级 2：涉及关系 (mention) — 增加市场限制 (兜底)
      if (!finalRelType && inSameMarket) {
        let hasSharedProduct = false;
        for (const custEnt of entsCust.values()) {
          if (custEnt.role === 'product' || custEnt.entity_type === 'product') {
            const matchedInProd = findEntityInReport(entsProd, '', custEnt.canonical_name);
            if (matchedInProd) {
              hasSharedProduct = true;
              break;
            }
          }
        }

        if (hasSharedProduct) {
          finalRelType = 'mention';
          finalRelKey = '涉及关系';
          if (targetReportId > bReportId) {
            sourceReportId = bReportId;
            targetReportIdCol = targetReportId;
          }
        }
      }
    }
    // ==========================================
    // 分支三：公司报告 VS 公司报告
    // ==========================================
    else if (targetCategory === 'customer' && bCategory === 'customer') {
      // 优先级 1: 竞争关系 (competitor) — 优先级最高！不受市场限制
      const aHasBAsComp = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'competitor';
      const bHasAAsComp = primaryEntityIdA && entMapB.has(primaryEntityIdA) && entMapB.get(primaryEntityIdA)!.role === 'competitor';

      const productsA = Array.from(currentEntMap.values())
        .filter(ent => ent.role === 'product' || ent.entity_type === 'product')
        .map(ent => ent.canonical_name.toLowerCase().trim());
      const productsB = Array.from(entMapB.values())
        .filter(ent => ent.role === 'product' || ent.entity_type === 'product')
        .map(ent => ent.canonical_name.toLowerCase().trim());
      const hasIntersectingProduct = productsA.some(p => productsB.includes(p));

      const hasSharedChannel = hasIntersectingProduct && Array.from(currentEntMap.entries()).some(([entIdA, dataA]) => {
        if (dataA.role === 'channel') {
          const dataB = entMapB.get(entIdA);
          return dataB && dataB.role === 'channel' && entIdA !== primaryEntityIdA && entIdA !== bPrimaryId;
        }
        return false;
      });

      const isRetailerA = RETAILER_ENTITIES.has(primaryEntNameA);
      const isRetailerB = RETAILER_ENTITIES.has(bPrimaryName);
      const isCrossRetailerBrand = (isRetailerA !== isRetailerB);

      if ((aHasBAsComp || bHasAAsComp || hasSharedChannel) && !isCrossRetailerBrand) {
        finalRelType = 'competitor';
        finalRelKey = '同业竞争';
        if (targetReportId > bReportId) {
          sourceReportId = bReportId;
          targetReportIdCol = targetReportId;
        }
      }

      // 优先级 2: 供销关系 (supplier) — 优先级第二！不受市场限制
      if (!finalRelType) {
        const isBothRetailers = (primaryEntNameA && RETAILER_ENTITIES.has(primaryEntNameA)) &&
                                (bPrimaryName && RETAILER_ENTITIES.has(bPrimaryName));

        if (!isBothRetailers) {
          let isASupplierOfB = false;
          let isBSupplierOfA = false;

          if (bPrimaryId) {
            const entInA = findEntityInReport(currentEntMap, bPrimaryId, bPrimaryName);
            if (entInA) {
              if (entInA.role === 'supplier') {
                isBSupplierOfA = true;
              } else if (entInA.role === 'customer') {
                isASupplierOfB = true;
              } else if (entInA.role === 'channel' && bPrimaryName && RETAILER_ENTITIES.has(bPrimaryName)) {
                isASupplierOfB = true;
              }
            }
          }

          if (primaryEntityIdA) {
            const entInB = findEntityInReport(entMapB, primaryEntityIdA, primaryEntNameA);
            if (entInB) {
              if (entInB.role === 'supplier') {
                isASupplierOfB = true;
              } else if (entInB.role === 'customer') {
                isBSupplierOfA = true;
              } else if (entInB.role === 'channel' && primaryEntNameA && RETAILER_ENTITIES.has(primaryEntNameA)) {
                isBSupplierOfA = true;
              }
            }
          }

          if (isASupplierOfB) {
            finalRelType = 'supplier';
            finalRelKey = '供销渠道';
            sourceReportId = targetReportId;
            targetReportIdCol = bReportId;
          } else if (isBSupplierOfA) {
            finalRelType = 'supplier';
            finalRelKey = '供销渠道';
            sourceReportId = bReportId;
            targetReportIdCol = targetReportId;
          }
        }
      }

      // 优先级 3: 涉及关系 (mention) — 最低兜底，且增加市场限制
      if (!finalRelType && inSameMarket) {
        const mentionsEachOther =
          (bPrimaryId && findEntityInReport(currentEntMap, bPrimaryId, bPrimaryName) !== null) ||
          (primaryEntityIdA && findEntityInReport(entMapB, primaryEntityIdA, primaryEntNameA) !== null);

        const hasSharedEntity = Array.from(currentEntMap.keys()).some(entIdA => entMapB.has(entIdA));

        if (mentionsEachOther || hasSharedEntity) {
          finalRelType = 'mention';
          finalRelKey = '涉及关系';
          if (targetReportId > bReportId) {
            sourceReportId = bReportId;
            targetReportIdCol = targetReportId;
          }
        }
      }
    }

    // 如果生成了有效的关系，写入数据库 relations 表，并自动将对应关系实体补写入 report_entities 表中
    if (finalRelType) {
      await dbClient.query(
        `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (report_id_a, report_id_b, relation_key) DO UPDATE SET relation_type = EXCLUDED.relation_type`,
        [sourceReportId, targetReportIdCol, finalRelKey, targetMarketRegion || '全球', finalRelType]
      );

      // 自动双向补充实体关键词到 report_entities 表中，确保关系实体界面完全覆盖
      if (finalRelType === 'competitor') {
        if (bPrimaryId) {
          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'competitor', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [targetReportId, bPrimaryId]
          );
        }
        if (primaryEntityIdA) {
          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'competitor', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [bReportId, primaryEntityIdA]
          );
        }
      } else if (finalRelType === 'supplier') {
        // sourceReportId 为供方，targetReportIdCol 为销方/渠道
        if (primaryEntityIdA && bPrimaryId) {
          const isAProducer = (sourceReportId === targetReportId);
          const supplierRepId = isAProducer ? targetReportId : bReportId;
          const channelRepId = isAProducer ? bReportId : targetReportId;
          const supplierEntId = isAProducer ? primaryEntityIdA : bPrimaryId;
          const channelEntId = isAProducer ? bPrimaryId : primaryEntityIdA;

          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'channel', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [supplierRepId, channelEntId]
          );
          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'supplier', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [channelRepId, supplierEntId]
          );
        }
      } else if (finalRelType === 'operation') {
        const prodReportId = (targetCategory === 'product') ? targetReportId : bReportId;
        const custReportId = (targetCategory === 'customer') ? targetReportId : bReportId;
        const prodEntId = (targetCategory === 'product') ? primaryEntityIdA : bPrimaryId;
        const custEntId = (targetCategory === 'customer') ? primaryEntityIdA : bPrimaryId;

        if (prodEntId && custReportId) {
          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'product', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [custReportId, prodEntId]
          );
        }
        if (custEntId && prodReportId) {
          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'channel', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [prodReportId, custEntId]
          );
        }
      } else if (finalRelType === 'mention') {
        if (bPrimaryId) {
          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'mentioned', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [targetReportId, bPrimaryId]
          );
        }
        if (primaryEntityIdA) {
          await dbClient.query(
            `INSERT INTO report_entities (report_id, entity_id, role, source)
             VALUES ($1, $2, 'mentioned', 'auto') ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [bReportId, primaryEntityIdA]
          );
        }
      }
    }
  }
}

/**
 * 全量重算图谱中所有报告的关系
 */
export async function recalculateAllRelations(dbClient: PoolClient): Promise<{ totalReports: number; totalRelations: number }> {
  await dbClient.query('BEGIN');
  try {
    // 1. 清空 relations 表
    await dbClient.query('TRUNCATE TABLE relations');

    // 2. 获取所有报告
    const reportsRes = await dbClient.query(
      `SELECT r.id, r.category, r.market_region, r.primary_entity_id, e.canonical_name AS primary_name
       FROM reports r
       LEFT JOIN entities e ON r.primary_entity_id = e.id`
    );

    const reports = reportsRes.rows;
    if (reports.length === 0) {
      await dbClient.query('COMMIT');
      return { totalReports: 0, totalRelations: 0 };
    }

    const reportIds = reports.map(r => r.id);

    // 3. 一次性获取所有报告实体
    const entsRes = await dbClient.query(
      `SELECT re.report_id, re.entity_id, re.role, e.canonical_name, e.entity_type
       FROM report_entities re
       JOIN entities e ON re.entity_id = e.id
       WHERE re.report_id = ANY($1)`,
      [reportIds]
    );

    const allEntsMap = new Map<string, Map<string, ReportEntityItem>>();
    for (const row of entsRes.rows) {
      if (!allEntsMap.has(row.report_id)) {
        allEntsMap.set(row.report_id, new Map());
      }
      allEntsMap.get(row.report_id)!.set(row.entity_id, {
        role: row.role,
        canonical_name: row.canonical_name,
        entity_type: row.entity_type
      });
    }

    // 4. 依次调用计算
    for (const rep of reports) {
      const currentEntMap = allEntsMap.get(rep.id) || new Map();
      const primaryName = rep.primary_name ? rep.primary_name.toLowerCase().trim() : '';

      await computeRelationsForReport(
        rep.id,
        rep.category || 'customer',
        rep.market_region || '全球',
        currentEntMap,
        primaryName,
        rep.primary_entity_id,
        dbClient
      );
    }

    // 5. 统计总数
    const countRes = await dbClient.query('SELECT COUNT(*)::int as count FROM relations');
    const totalRelations = countRes.rows[0].count;

    await dbClient.query('COMMIT');
    return { totalReports: reports.length, totalRelations };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  }
}
