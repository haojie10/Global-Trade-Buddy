export interface EntityDefinition {
  name: string;
  type: 'company' | 'product' | 'channel';
  match: string[];
}

export const ENTITY_DEFINITIONS: EntityDefinition[] = [
  { name: 'A 公司', type: 'company', match: ['A 公司', 'A Company', '美国A公司', '美国 A 公司'] },
  { name: 'B 公司', type: 'company', match: ['B 公司', 'B Company', '德国 B 公司'] },
  { name: '丰田汽车', type: 'company', match: ['丰田', 'Toyota'] },
  { name: '铝合金轮毂', type: 'product', match: ['铝合金轮毂', '轮毂'] },
  { name: '刹车片', type: 'product', match: ['刹车片'] },
  { name: '紧固件', type: 'product', match: ['紧固件', '螺丝', '螺栓'] },
  { name: '发光壁挂绿植环', type: 'product', match: ['绿植', 'Wall Decor Rings'] },
  { name: '中东非公路工程车桥', type: 'product', match: ['车桥', '工程车桥'] },
  { name: '配件超市', type: 'channel', match: ['汽配连锁超市', '连锁配件超市', '连锁超市'] },
  { name: '一级供应链', type: 'channel', match: ['一级供应链', '供应链体系'] },
  { name: '运费波动', type: 'product', match: ['运费波动'] },
  { name: '欧美汽配', type: 'product', match: ['欧美汽配'] },
  { name: '汇率风险', type: 'product', match: ['汇率风险'] },
];

export const BLACKLIST = ['公司', '工厂', '超市', '产品', '客户', '供应商', '采购商', '贸易'];

export const commonKeywords = ['A 公司', '铝合金轮毂', '刹车片', '欧美汽配', '汇率风险', '运费波动'];

// 已知零售巨头与超市渠道集合，用于判断同业竞争关系
export const RETAILER_ENTITIES = new Set([
  'x5 group', 'x5 retail', 'magnit', 'lenta', 'auchan', 'dixy',
  'detsky mir', '儿童世界', 'hoff', 'leroy merlin', 'ikea', '宜家',
  'obi', '欧倍德', 'obi group holding se & co. kgaa',
  'bauhaus', '包豪斯', 'bauhaus ag',
  'hornbach', '霍恩巴赫', 'hornbach baumarkt ag',
  'toom', 'toom baumarkt', 'toom baumarkt gmbh',
  'hagebau', '哈格堡'
]);
