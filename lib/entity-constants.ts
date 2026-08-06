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

// 已知零售巨头与超市/批发分销渠道集合，用于屏蔽虚假供销关系并判断同业竞争
export const RETAILER_ENTITIES = new Set([
  // 北美主流零售巨头 & 折扣商超
  'dollar general', 'dollar tree', 'family dollar', 'walmart', '沃尔玛', 'target', '塔吉特',
  'costco', '好市多', 'bj\'s wholesale club', 'bjs wholesale club', 'bjs wholesale', 'bjs',
  'jcpenney', 'j. c. penney', 'h-e-b', 'heb', 'marshalls', 'kroger', '克罗格', 'hobby lobby',
  'ross stores', 'ross', 'tj maxx', 'tjmaxx', 't.j. maxx', 'homegoods', 'sierra', 'marshalls',
  'world market', 'cost plus world market', 'tractor supply', 'tractor supply company', 'rural king',
  'ocean state job lot', 'waldo\'s dólar mart', 'waldo\'s dólar mart de méxico', 'waldo',
  'crate & barrel', 'crate and barrel', 'dunelm', 'the range', 'b&m', 'b&m stores', 'b&m retail',

  // 欧洲与俄语区主流零售巨头 & 建材五金
  'x5 group', 'x5 retail', 'magnit', 'lenta', 'auchan', 'dixy',
  'detsky mir', '儿童世界', 'hoff', 'leroy merlin', 'ikea', '宜家',
  'obi', '欧倍德', 'obi group holding se & co. kgaa',
  'bauhaus', '包豪斯', 'bauhaus ag',
  'hornbach', '霍恩巴赫', 'hornbach baumarkt ag',
  'toom', 'toom baumarkt', 'toom baumarkt gmbh',
  'hagebau', '哈格堡',
  'home depot', 'homedepot', '家得宝',
  'lowes', 'lowe\'s', '劳氏',
  'cef', 'city electrical factors', 'city electrical factors limited', 'city electric supply',
  'rexel', 'rexel uk', 'edmundson', 'edmundson electrical',
  'yesss', 'yesss electrical', 'screwfix', 'toolstation',
  'aldi', 'lidl', 'tesco', 'carrefour', '家乐福', 'jumbo', 'dirk van den broek',
  'esselunga', 'polomarket', 'grupo éxito', 'home sentry', 'john lewis', 'john lewis & partners',
  'cencosud', 'jumbo chile'
]);
