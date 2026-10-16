import type { GroupId, MapId, Space } from './types.ts'

export const GROUPS: Record<GroupId, { label: string; en: string; color: string; house: number }> = {
  brown: { label: '棕色', en: 'Brown', color: '#8a5a3c', house: 50 },
  lightblue: { label: '浅蓝', en: 'Light blue', color: '#b7d4e6', house: 50 },
  pink: { label: '粉色', en: 'Pink', color: '#e5a9bf', house: 100 },
  orange: { label: '橙色', en: 'Orange', color: '#eea15a', house: 100 },
  red: { label: '红色', en: 'Red', color: '#d25b52', house: 150 },
  yellow: { label: '黄色', en: 'Yellow', color: '#e4c65e', house: 150 },
  green: { label: '绿色', en: 'Green', color: '#67996f', house: 200 },
  navy: { label: '深蓝', en: 'Dark blue', color: '#3f5f86', house: 200 },
}

function P(id: number, name: string, en: string, group: GroupId, price: number, rent: number[]): Space {
  return {
    id,
    name,
    short: name,
    en,
    enShort: en,
    type: 'property',
    group,
    price,
    rent,
    houseCost: GROUPS[group].house,
    mortgage: price / 2,
  }
}

function rail(id: number, name: string, en: string, enShort = en): Space {
  return { id, name, short: name, en, enShort, type: 'railroad', price: 200, mortgage: 100 }
}

function utility(id: number, name: string, en: string, enShort = en): Space {
  return { id, name, short: name, en, enShort, type: 'utility', price: 150, mortgage: 75 }
}

function spot(id: number, name: string, short: string, en: string, enShort: string, type: Space['type'], extra: Partial<Space> = {}): Space {
  return { id, name, short, en, enShort, type, ...extra }
}

/** 下标就是棋盘位置。0 在右下角起点，顺时针走到 39。 */
const BASE_SPACES: Space[] = [
  spot(0, '起点', '起点', 'GO', 'GO', 'go'),
  P(1, '景德镇', 'Houston', 'brown', 60, [2, 10, 30, 90, 160, 250]),
  spot(2, '公益金', '公益金', 'Community Chest', 'Chest', 'chest'),
  P(3, '南昌', 'Dallas', 'brown', 60, [4, 20, 60, 180, 320, 450]),
  spot(4, '所得税', '所得税', 'Income Tax', 'Tax', 'tax', { tax: 200 }),
  rail(5, '合肥南站', 'Dallas Fort Worth International Airport', 'DFW Airport'),
  P(6, '黄山', 'Orlando', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  spot(7, '机会', '机会', 'Chance', 'Chance', 'chance'),
  P(8, '马鞍山', 'Tampa', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  P(9, '合肥', 'Miami', 'lightblue', 120, [8, 40, 100, 300, 450, 600]),
  spot(10, '监狱', '监狱', 'Jail', 'Jail', 'jail'),
  utility(11, '国家电网', 'Electric Company', 'Electric'),
  P(12, '攀枝花', 'Juneau', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  P(13, '自贡', 'Fairbanks', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  P(14, '成都', 'Anchorage', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  rail(15, '天府站', 'Harry Reid International Airport', 'LAS Airport'),
  P(16, '烟台', 'Carson City', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  spot(17, '公益金', '公益金', 'Community Chest', 'Chest', 'chest'),
  P(18, '济南', 'Reno', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  P(19, '青岛', 'Las Vegas', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
  spot(20, '免费停车', '停车', 'Free Parking', 'Parking', 'parking'),
  P(21, '温州', 'Hilo', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  spot(22, '机会', '机会', 'Chance', 'Chance', 'chance'),
  P(23, '宁波', 'Kailua-Kona', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  P(24, '杭州', 'Honolulu', 'red', 240, [20, 100, 300, 750, 925, 1100]),
  rail(25, '南京南站', 'Seattle–Tacoma International Airport', 'SEA Airport'),
  P(26, '扬州', 'Spokane', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  P(27, '苏州', 'Tacoma', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility(28, '自来水厂', 'Water Works', 'Water'),
  P(29, '南京', 'Seattle', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
  spot(30, '前往监狱', '入狱', 'Go to Jail', 'Jail', 'gotojail'),
  P(31, '广州', 'San Diego', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  P(32, '深圳', 'San Francisco', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  spot(33, '公益金', '公益金', 'Community Chest', 'Chest', 'chest'),
  P(34, '香港', 'Los Angeles', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
  rail(35, '上海虹桥', 'Los Angeles International Airport', 'LAX Airport'),
  spot(36, '机会', '机会', 'Chance', 'Chance', 'chance'),
  P(37, '北京', 'Washington, D.C.', 'navy', 350, [35, 175, 500, 1100, 1300, 1500]),
  spot(38, '奢侈税', '奢侈税', 'Luxury Tax', 'Luxury', 'tax', { tax: 100 }),
  P(39, '上海', 'New York', 'navy', 400, [50, 200, 600, 1400, 1700, 2000]),
]

/** Map geography is independent of each player's display language. */
const CHINA_EN: Record<number, string> = {
  1: 'Jingdezhen', 3: 'Nanchang', 5: 'Hefei South Railway Station',
  6: 'Huangshan', 8: 'Ma’anshan', 9: 'Hefei', 11: 'State Grid', 12: 'Panzhihua', 13: 'Zigong',
  14: 'Chengdu', 15: 'Tianfu Railway Station', 16: 'Yantai', 18: 'Jinan',
  19: 'Qingdao', 21: 'Wenzhou', 23: 'Ningbo', 24: 'Hangzhou',
  25: 'Nanjing South Railway Station', 26: 'Yangzhou', 27: 'Suzhou',
  29: 'Nanjing', 31: 'Guangzhou', 32: 'Shenzhen', 34: 'Hong Kong',
  35: 'Shanghai Hongqiao Railway Station', 37: 'Beijing', 39: 'Shanghai',
}
const CHINA_EN_SHORT: Record<number, string> = {
  5: 'Hefei South', 15: 'Tianfu Station', 25: 'Nanjing South', 35: 'Hongqiao Station',
}
const USA_ZH: Record<number, string> = {
  1: '休斯敦', 3: '达拉斯', 5: '达拉斯沃思堡国际机场',
  6: '奥兰多', 8: '坦帕', 9: '迈阿密', 11: '电力公司', 12: '朱诺',
  13: '费尔班克斯', 14: '安克雷奇', 15: '哈里·里德国际机场',
  16: '卡森城', 18: '里诺', 19: '拉斯维加斯', 21: '希洛',
  23: '凯鲁瓦-科纳', 24: '檀香山', 25: '西雅图塔科马国际机场',
  26: '斯波坎', 27: '塔科马', 29: '西雅图', 31: '圣地亚哥',
  32: '旧金山', 34: '洛杉矶', 35: '洛杉矶国际机场', 37: '华盛顿特区', 39: '纽约',
}
const USA_ZH_SHORT: Record<number, string> = {
  5: 'DFW机场', 15: 'LAS机场', 25: 'SEA机场', 35: 'LAX机场',
}
export const SPACES: Space[] = BASE_SPACES.map((space) => ({
  ...space,
  en: CHINA_EN[space.id] ?? space.en,
  enShort: CHINA_EN_SHORT[space.id] ?? CHINA_EN[space.id] ?? space.enShort,
}))
const USA_SPACES: Space[] = BASE_SPACES.map((space) => ({
  ...space,
  name: USA_ZH[space.id] ?? space.name,
  short: USA_ZH_SHORT[space.id] ?? USA_ZH[space.id] ?? space.short,
}))
export function isMapId(value: unknown): value is MapId {
  return value === 'china' || value === 'usa'
}
export function spacesForMap(mapId: MapId = 'china'): Space[] {
  return mapId === 'usa' ? USA_SPACES : SPACES
}

export type Lang = 'zh' | 'en'

const REGIONS: Record<MapId, Record<GroupId, { zh: string; en: string }>> = {
  china: {
    brown: { zh: '江西省', en: 'Jiangxi' },
    lightblue: { zh: '安徽省', en: 'Anhui' },
    pink: { zh: '四川省', en: 'Sichuan' },
    orange: { zh: '山东省', en: 'Shandong' },
    red: { zh: '浙江省', en: 'Zhejiang' },
    yellow: { zh: '江苏省', en: 'Jiangsu' },
    green: { zh: '广东省', en: 'Guangdong' },
    navy: { zh: '直辖市', en: 'Municipalities' },
  },
  usa: {
    brown: { zh: '德克萨斯州', en: 'Texas' },
    lightblue: { zh: '佛罗里达州', en: 'Florida' },
    pink: { zh: '阿拉斯加州', en: 'Alaska' },
    orange: { zh: '内华达州', en: 'Nevada' },
    red: { zh: '夏威夷州', en: 'Hawaii' },
    yellow: { zh: '华盛顿州', en: 'Washington' },
    green: { zh: '加利福尼亚州', en: 'California' },
    navy: { zh: '美国东部', en: 'Eastern U.S.' },
  },
}

export function propertyRegion(space: Space, mapId: MapId, lang: Lang): string {
  if (!space.group) return ''
  if (mapId === 'china' && space.id === 34) return lang === 'en' ? 'Hong Kong SAR' : '香港特别行政区'
  return REGIONS[mapId][space.group][lang]
}

export function spaceLabel(space: Space | undefined, lang: Lang, short = false): string {
  if (!space) return ''
  if (lang === 'en') return short ? space.enShort : space.en
  return short ? space.short : space.name
}

export const RAILROAD_IDS = [5, 15, 25, 35]
export const UTILITY_IDS = [11, 28]

export function spacesInGroup(group: GroupId): Space[] {
  return SPACES.filter((s) => s.group === group)
}

export function isDeed(space: Space): boolean {
  return space.type === 'property' || space.type === 'railroad' || space.type === 'utility'
}
