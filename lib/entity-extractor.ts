import { ENTITY_DEFINITIONS, BLACKLIST, commonKeywords } from './entity-constants';

// 1. 从 HTML 字符串中提取元数据和专有名词（客户名、品类名等）
export function parseMetadata(html: string) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const categoryMatch = html.match(/<meta[^>]*?name="category"[^>]*?content="([^"]*?)"/i);
  const regionMatch = html.match(/<meta[^>]*?name="market_region"[^>]*?content="([^"]*?)"/i);
  const summaryMatch = html.match(/<meta[^>]*?name="summary"[^>]*?content="([^"]*?)"/i);

  const title = titleMatch ? titleMatch[1].trim() : '未命名报告';
  const category = categoryMatch ? categoryMatch[1].trim() : 'customer';
  const market_region = regionMatch ? regionMatch[1].trim() : '全球';
  const summary = summaryMatch ? summaryMatch[1].trim() : '';

  // 简单的专有名词实体抽取（模拟 NER）
  // 匹配常见的中国外贸相关实体，或正文里的 <h1>, <h2> 等大字标题
  const entities: string[] = [];
  
  // 提取 <h1>/<h2> 里的名词
  const headerMatches = html.matchAll(/<h[12]>[^<]*?(A 公司|铝合金轮毂|欧美汽配|刹车片|发动机|螺丝)[^<]*?<\/h[12]>/gi);
  for (const match of Array.from(headerMatches)) {
    const text = match[0].replace(/<[^>]*>/g, '').trim();
    if (text.includes('A 公司')) entities.push('A 公司');
    if (text.includes('铝合金轮毂')) entities.push('铝合金轮毂');
  }

  // 兜底提取：在标题和正文里检索常见关键词
  commonKeywords.forEach(kw => {
    if (html.includes(kw) && !entities.includes(kw)) {
      entities.push(kw);
    }
  });

  // 智能提取研究主体
  const parts = title.split(/ - | 360°|360°/);
  const primary_subject = parts[0] ? parts[0].trim() : '';

  return {
    title,
    category,
    market_region,
    summary,
    entities,
    primary_subject,
  };
}

// 2. 剥离 Base64 大图并替换为云存储 CDN 地址
type UploadFn = (buffer: Buffer, mimeType: string) => Promise<string>;

export async function runDehydration(html: string, uploadFn: UploadFn) {
  let cleanHtml = html;
  let imageCount = 0;
  
  // 匹配任何 data:image/([a-zA-Z]*);base64, 格式的正则，兼容 src="...", url('...')
  const base64Regex = /data:image\/([a-zA-Z]*);base64,([^"'\)]*)/g;
  let match;
  
  const replacements: { raw: string; url: string }[] = [];
  
  while ((match = base64Regex.exec(html)) !== null) {
    const ext = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const mimeType = `image/${ext}`;
    const url = await uploadFn(buffer, mimeType);
    
    replacements.push({
      raw: match[0],
      url: url
    });
    imageCount++;
  }
  
  replacements.forEach(rep => {
    cleanHtml = cleanHtml.replace(rep.raw, rep.url);
  });
  
  return {
    cleanHtml,
    imageCount,
  };
}

// 3. 提取并归一化实体
export async function extractAndNormalizeEntities(
  html: string,
  title: string,
  dbClient: any,
  manualTags?: {
    companies?: string[];
    companyWebsite?: string;
    competitors?: string[];
    suppliers?: string[];
    customers?: string[];
    sisters?: string[];
    products?: string[];
    regions?: string[];
    channels?: string[];
  },
  primarySubject?: string,
  category?: string
): Promise<{ id: string; canonical_name: string; role: string }[]> {
  // 1. 从 entities 和 entity_aliases 表读取所有已知的实体名和别名
  const entitiesRes = await dbClient.query(`
    SELECT e.id, e.canonical_name, e.entity_type, ea.alias_name
    FROM entities e
    LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
  `);

  const entityMap = new Map<string, { id: string; canonical_name: string; entity_type: string; matches: Set<string> }>();
  for (const row of entitiesRes.rows) {
    let ent = entityMap.get(row.id);
    if (!ent) {
      ent = {
        id: row.id,
        canonical_name: row.canonical_name,
        entity_type: row.entity_type,
        matches: new Set<string>()
      };
      ent.matches.add(row.canonical_name);
      entityMap.set(row.id, ent);
    }
    if (row.alias_name) {
      ent.matches.add(row.alias_name);
    }
  }

  const matchedEntities = new Map<string, { id: string; canonical_name: string; entity_type: string }>();
  const searchContent = title + ' ' + html;

  // 2. 检索已知实体和别名
  for (const ent of entityMap.values()) {
    for (const matchStr of ent.matches) {
      if (searchContent.includes(matchStr)) {
        matchedEntities.set(ent.id, { id: ent.id, canonical_name: ent.canonical_name, entity_type: ent.entity_type });
        break;
      }
    }
  }

  // 3. 处理手动标记的实体 (优先级高，自动注册未知实体)
  if (manualTags) {
    // 3.1 特殊处理公司标签：如果有多个公司标签，则取第一个作为标准名称，其余全部自动作为其别称并入数据库别称表，不在图上显示多个圆点
    if (manualTags.companies && manualTags.companies.length > 0) {
      const companyTags = manualTags.companies.map((c: string) => c.trim()).filter(Boolean);
      if (companyTags.length > 0) {
        const primaryTag = companyTags[0];
        let primaryEntityId = '';
        let primaryCanonicalName = primaryTag;

        // 检查是否已有同名实体或已有的别称
        for (const ent of entityMap.values()) {
          if (ent.matches.has(primaryTag)) {
            primaryEntityId = ent.id;
            primaryCanonicalName = ent.canonical_name;
            break;
          }
        }

        if (!primaryEntityId) {
          // 不存在，插入 entities 表作为主标准公司名
          const insertRes = await dbClient.query(
            `INSERT INTO entities (canonical_name, entity_type, website) 
             VALUES ($1, 'company', $2) 
             ON CONFLICT (canonical_name) DO UPDATE SET 
               entity_type = EXCLUDED.entity_type,
               website = COALESCE(entities.website, EXCLUDED.website)
             RETURNING id`,
            [primaryTag, manualTags.companyWebsite || null]
          );
          primaryEntityId = insertRes.rows[0].id;
          
          // 动态加入缓存
          entityMap.set(primaryEntityId, {
            id: primaryEntityId,
            canonical_name: primaryTag,
            entity_type: 'company',
            matches: new Set([primaryTag])
          });
        } else if (manualTags.companyWebsite) {
          // 如果已存在且传入了官网，若数据库中官网为空，则更新它
          await dbClient.query(
            `UPDATE entities SET website = COALESCE(website, $1) WHERE id = $2`,
            [manualTags.companyWebsite, primaryEntityId]
          );
        }

        // 记录标准实体
        matchedEntities.set(primaryEntityId, { id: primaryEntityId, canonical_name: primaryCanonicalName, entity_type: 'company' });

        // 将第 2 个及以后的公司名称自动作为第一个公司的别称写入别名表
        for (let i = 1; i < companyTags.length; i++) {
          const aliasTag = companyTags[i];
          let existingEntityId = '';

          // 检索已知实体和别称中是否已经有匹配此别名的实体
          for (const ent of entityMap.values()) {
            const matchesLower = Array.from(ent.matches).map(x => x.toLowerCase());
            if (matchesLower.includes(aliasTag.toLowerCase())) {
              existingEntityId = ent.id;
              break;
            }
          }

          if (existingEntityId) {
            if (existingEntityId !== primaryEntityId) {
              // 自动执行实体合并与消歧逻辑：
              // 当管理员在 companies 标签里显式把 aliasTag 指定为 primaryEntityId 公司的别称，
              // 但数据库却已存在另一个独立实体时，说明两个实体在物理上是同一个。我们需要执行数据迁移合并。
              console.log(`Auto merging entity "${existingEntityId}" into target primary entity "${primaryEntityId}" (alias match: "${aliasTag}")`);

              // 1. 将旧实体的所有别称和新别名全部迁移到新标准实体下
              await dbClient.query(
                `UPDATE entity_aliases SET entity_id = $1 WHERE entity_id = $2`,
                [primaryEntityId, existingEntityId]
              );
              await dbClient.query(
                `INSERT INTO entity_aliases (entity_id, alias_name)
                 VALUES ($1, $2)
                 ON CONFLICT (alias_name) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
                [primaryEntityId, aliasTag]
              );

              // 2. 将旧实体的报告引用映射转移给新标准实体
              const repEnts = await dbClient.query(
                `SELECT report_id, role FROM report_entities WHERE entity_id = $1`,
                [existingEntityId]
              );
              for (const re of repEnts.rows) {
                await dbClient.query(
                  `INSERT INTO report_entities (report_id, entity_id, role)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role`,
                  [re.report_id, primaryEntityId, re.role]
                );
              }
              await dbClient.query(
                `DELETE FROM report_entities WHERE entity_id = $1`,
                [existingEntityId]
              );

              // 3. 将旧实体的实体关系 (entity_relations) 转移给新标准实体
              const relsA = await dbClient.query(
                `SELECT entity_id_b, relation_type, market_region FROM entity_relations WHERE entity_id_a = $1`,
                [existingEntityId]
              );
              for (const rel of relsA.rows) {
                await dbClient.query(
                  `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) DO NOTHING`,
                  [primaryEntityId, rel.entity_id_b, rel.relation_type, rel.market_region]
                );
              }
              const relsB = await dbClient.query(
                `SELECT entity_id_a, relation_type, market_region FROM entity_relations WHERE entity_id_b = $1`,
                [existingEntityId]
              );
              for (const rel of relsB.rows) {
                await dbClient.query(
                  `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) DO NOTHING`,
                  [rel.entity_id_a, primaryEntityId, rel.relation_type, rel.market_region]
                );
              }
              await dbClient.query(
                `DELETE FROM entity_relations WHERE entity_id_a = $1 OR entity_id_b = $1`,
                [existingEntityId]
              );

              // 4. 从 entities 表中物理删除该旧实体
              await dbClient.query(
                `DELETE FROM entities WHERE id = $1`,
                [existingEntityId]
              );

              // 同步清除已匹配实体缓存，防止脏数据带入后续操作引发外键冲突
              matchedEntities.delete(existingEntityId);

              // 5. 更新缓存，将原有实体的匹配名集合和当前别名称合并入主缓存
              const primaryCached = entityMap.get(primaryEntityId);
              const oldCached = entityMap.get(existingEntityId);
              if (primaryCached && oldCached) {
                for (const m of oldCached.matches) {
                  primaryCached.matches.add(m);
                }
                primaryCached.matches.add(aliasTag);
              }
              entityMap.delete(existingEntityId);
            }
          } else {
            // 不存在任何同名实体或别称，正常注册别名
            await dbClient.query(
              `INSERT INTO entity_aliases (entity_id, alias_name)
               VALUES ($1, $2)
               ON CONFLICT (alias_name) DO NOTHING`,
              [primaryEntityId, aliasTag]
            );

            // 动态扩充缓存
            const cachedEnt = entityMap.get(primaryEntityId);
            if (cachedEnt) {
              cachedEnt.matches.add(aliasTag);
            }
          }
        }
      }
    }

    // 3.2 正常处理产品、渠道、竞争对手、供应商、客户和姐妹公司标签
    const otherCategories = [
      { tags: manualTags.competitors, type: 'competitor' },
      { tags: manualTags.suppliers, type: 'company' }, // 手动供应商作为 company
      { tags: manualTags.customers, type: 'company' }, // 手动客户作为 company
      { tags: manualTags.sisters, type: 'company' }, // 手动姐妹公司作为 company
      { tags: manualTags.products, type: 'product' },
      { tags: manualTags.channels, type: 'channel' }
    ];

    for (const cat of otherCategories) {
      if (!cat.tags) continue;
      for (const rawTag of cat.tags) {
        const tag = rawTag.trim();
        if (!tag) continue;

        // 查找是否已存在于已知实体或别名中
        let foundEntity: { id: string; canonical_name: string; entity_type: string } | null = null;
        for (const ent of entityMap.values()) {
          if (ent.matches.has(tag)) {
            foundEntity = { id: ent.id, canonical_name: ent.canonical_name, entity_type: ent.entity_type };
            break;
          }
        }

        if (foundEntity) {
          matchedEntities.set(foundEntity.id, foundEntity);
        } else {
          // 不存在，则自动写入 entities 表，扩充词库
          const insertRes = await dbClient.query(
            `INSERT INTO entities (canonical_name, entity_type) 
             VALUES ($1, $2) 
             ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
             RETURNING id`,
            [tag, cat.type]
          );
          const entId = insertRes.rows[0].id;
          const newEntity = { id: entId, canonical_name: tag, entity_type: cat.type };
          matchedEntities.set(entId, newEntity);
          
          // 动态加入内存缓存，防止本次事务后续重复插入
          entityMap.set(entId, {
            id: entId,
            canonical_name: tag,
            entity_type: cat.type,
            matches: new Set([tag])
          });
        }
      }
    }
  }

  // 4. 正文匹配兜底逻辑：继续在标题和正文里检索常见关键词，如果 HTML 包含它们且它们不在已提取列表中，将其作为实体提取。
  const keywordTypeMap: Record<string, string> = {};
  ENTITY_DEFINITIONS.forEach(def => {
    keywordTypeMap[def.name] = def.type;
  });

  const extractedNames = new Set<string>();
  for (const ent of matchedEntities.values()) {
    extractedNames.add(ent.canonical_name);
  }

  for (const kw of commonKeywords) {
    if (searchContent.includes(kw) && !extractedNames.has(kw)) {
      const type = keywordTypeMap[kw] || 'product';
      const insertRes = await dbClient.query(
        `INSERT INTO entities (canonical_name, entity_type) 
         VALUES ($1, $2) 
         ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
         RETURNING id`,
        [kw, type]
      );
      const entId = insertRes.rows[0].id;
      matchedEntities.set(entId, { id: entId, canonical_name: kw, entity_type: type });
      extractedNames.add(kw);
    }
  }

  // 5. 判定实体在此报告中的具体角色 (role)
  // 获取报告研究本体的主实体 ID
  let primaryId = '';
  if (category === 'customer' && primarySubject) {
    for (const ent of entityMap.values()) {
      if (ent.matches.has(primarySubject)) {
        primaryId = ent.id;
        break;
      }
    }
  }

  // 兜底逻辑：若通过 title 前缀未匹配到，则直接取 manualTags.companies 的第一个元素
  if (!primaryId && category === 'customer' && manualTags?.companies && manualTags.companies.length > 0) {
    const firstCompany = manualTags.companies[0].trim();
    for (const ent of entityMap.values()) {
      if (ent.matches.has(firstCompany)) {
        primaryId = ent.id;
        break;
      }
    }
  }

  // 如果匹配成功，但标题简称 primarySubject 还不在别名表中，自动为其建立别名绑定
  if (primaryId && primarySubject) {
    const cachedEnt = entityMap.get(primaryId);
    if (cachedEnt && !cachedEnt.matches.has(primarySubject)) {
      // 检测是否与其他主名或别名冲突，防止唯一性键冲突
      let isConflict = false;
      for (const ent of entityMap.values()) {
        if (ent.matches.has(primarySubject)) {
          isConflict = true;
          break;
        }
      }
      if (!isConflict) {
        await dbClient.query(
          `INSERT INTO entity_aliases (entity_id, alias_name) VALUES ($1, $2) ON CONFLICT (alias_name) DO NOTHING`,
          [primaryId, primarySubject]
        );
        cachedEnt.matches.add(primarySubject);
        console.log(`Auto bound title subject "${primarySubject}" as alias to entity "${cachedEnt.canonical_name}"`);
      }
    }
  }

  const result: { id: string; canonical_name: string; role: string }[] = [];
  for (const ent of matchedEntities.values()) {
    if (BLACKLIST.includes(ent.canonical_name)) {
      continue;
    }

    let role = 'mentioned';

    if (ent.id === primaryId) {
      role = 'primary';
    } else if (manualTags) {
      // 提取本实体的所有别称（包括主标准名）并转为小写
      const cachedEnt = entityMap.get(ent.id);
      const matchesLower = cachedEnt 
        ? Array.from(cachedEnt.matches).map(x => x.toLowerCase())
        : [ent.canonical_name.toLowerCase()];

      const hasMatch = (tagsList?: string[]) => {
        if (!tagsList) return false;
        const lowerTags = tagsList.map(x => x.toLowerCase().trim()).filter(Boolean);
        return matchesLower.some(m => lowerTags.includes(m));
      };

      if (hasMatch(manualTags.competitors)) {
        role = 'competitor';
      } else if (hasMatch(manualTags.suppliers)) {
        role = 'supplier';
      } else if (hasMatch(manualTags.customers)) {
        role = 'customer';
      } else if (hasMatch(manualTags.sisters)) {
        role = 'sister_parent';
      } else if (hasMatch(manualTags.products)) {
        role = 'product';
      } else if (hasMatch(manualTags.channels)) {
        role = 'channel';
      }
    }

    // 如果还没有命中特定角色，则根据实体类型进行兜底映射
    if (role === 'mentioned') {
      if (ent.entity_type === 'product') {
        role = 'product';
      } else if (ent.entity_type === 'channel') {
        role = 'channel';
      } else if (ent.entity_type === 'competitor') {
        role = 'competitor';
      }
    }

    result.push({
      id: ent.id,
      canonical_name: ent.canonical_name,
      role
    });
  }

  return result;
}
