import type { GroupId, Space } from './types.ts'

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
export const SPACES: Space[] = [
  spot(0, '起点', '起点', 'GO', 'GO', 'go'),
  P(1, '景德镇', 'Jingdezhen', 'brown', 60, [2, 10, 30, 90, 160, 250]),
  spot(2, '公益基金', '公益', 'Community Chest', 'Chest', 'chest'),
  P(3, '南昌', 'Nanchang', 'brown', 60, [4, 20, 60, 180, 320, 450]),
  spot(4, '所得税', '所得税', 'Income Tax', 'Tax', 'tax', { tax: 200 }),
  rail(5, '合肥南站', 'Hefei South', 'Hefei S.'),
  P(6, '黄山', 'Huangshan', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  spot(7, '机会', '机会', 'Chance', 'Chance', 'chance'),
  P(8, '马鞍山', "Ma'anshan", 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  P(9, '合肥', 'Hefei', 'lightblue', 120, [8, 40, 100, 300, 450, 600]),
  spot(10, '监狱', '监狱', 'Jail', 'Jail', 'jail'),
  utility(11, '国家电网', 'State Grid', 'Grid'),
  P(12, '攀枝花', 'Panzhihua', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  P(13, '自贡', 'Zigong', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  P(14, '成都', 'Chengdu', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  rail(15, '天府站', 'Tianfu'),
  P(16, '烟台', 'Yantai', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  spot(17, '公益基金', '公益', 'Community Chest', 'Chest', 'chest'),
  P(18, '济南', 'Jinan', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  P(19, '青岛', 'Qingdao', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
  spot(20, '免费停车', '停车', 'Free Parking', 'Parking', 'parking'),
  P(21, '温州', 'Wenzhou', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  spot(22, '机会', '机会', 'Chance', 'Chance', 'chance'),
  P(23, '宁波', 'Ningbo', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  P(24, '杭州', 'Hangzhou', 'red', 240, [20, 100, 300, 750, 925, 1100]),
  rail(25, '南京南站', 'Nanjing South', 'Nanjing S.'),
  P(26, '扬州', 'Yangzhou', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  P(27, '苏州', 'Suzhou', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility(28, '自来水厂', 'Waterworks', 'Water'),
  P(29, '南京', 'Nanjing', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
  spot(30, '进监狱', '入狱', 'Go to Jail', 'Jail', 'gotojail'),
  P(31, '广州', 'Guangzhou', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  P(32, '深圳', 'Shenzhen', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  spot(33, '公益基金', '公益', 'Community Chest', 'Chest', 'chest'),
  P(34, '香港', 'Hong Kong', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
  rail(35, '上海虹桥', 'Hongqiao', 'Hongqiao'),
  spot(36, '机会', '机会', 'Chance', 'Chance', 'chance'),
  P(37, '北京', 'Beijing', 'navy', 350, [35, 175, 500, 1100, 1300, 1500]),
  spot(38, '奢侈税', '奢侈税', 'Luxury Tax', 'Luxury', 'tax', { tax: 100 }),
  P(39, '上海', 'Shanghai', 'navy', 400, [50, 200, 600, 1400, 1700, 2000]),
]

export type Lang = 'zh' | 'en'

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
