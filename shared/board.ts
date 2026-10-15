import type { GroupId, Space } from './types.ts'

export const GROUPS: Record<GroupId, { label: string; color: string; house: number }> = {
  brown: { label: '棕色', color: '#8a5a3c', house: 50 },
  lightblue: { label: '浅蓝', color: '#b7d4e6', house: 50 },
  pink: { label: '粉色', color: '#e5a9bf', house: 100 },
  orange: { label: '橙色', color: '#eea15a', house: 100 },
  red: { label: '红色', color: '#d25b52', house: 150 },
  yellow: { label: '黄色', color: '#e4c65e', house: 150 },
  green: { label: '绿色', color: '#67996f', house: 200 },
  navy: { label: '深蓝', color: '#3f5f86', house: 200 },
}

function P(
  id: number,
  name: string,
  short: string,
  group: GroupId,
  price: number,
  rent: number[],
): Space {
  return {
    id,
    name,
    short,
    type: 'property',
    group,
    price,
    rent,
    houseCost: GROUPS[group].house,
    mortgage: price / 2,
  }
}

function rail(id: number, name: string, short: string): Space {
  return { id, name, short, type: 'railroad', price: 200, mortgage: 100 }
}

function utility(id: number, name: string, short: string): Space {
  return { id, name, short, type: 'utility', price: 150, mortgage: 75 }
}

/** 下标就是棋盘位置。0 在右下角起点，顺时针走到 39。 */
export const SPACES: Space[] = [
  { id: 0, name: '起点', short: '起点', type: 'go' },
  P(1, '景德镇', '景德镇', 'brown', 60, [2, 10, 30, 90, 160, 250]),
  { id: 2, name: '公益基金', short: '公益', type: 'chest' },
  P(3, '南昌', '南昌', 'brown', 60, [4, 20, 60, 180, 320, 450]),
  { id: 4, name: '所得税', short: '所得税', type: 'tax', tax: 200 },
  rail(5, '合肥南站', '合肥南站'),
  P(6, '黄山', '黄山', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  { id: 7, name: '机会', short: '机会', type: 'chance' },
  P(8, '马鞍山', '马鞍山', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  P(9, '合肥', '合肥', 'lightblue', 120, [8, 40, 100, 300, 450, 600]),
  { id: 10, name: '监狱', short: '监狱', type: 'jail' },
  utility(11, '国家电网', '国家电网'),
  P(12, '攀枝花', '攀枝花', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  P(13, '自贡', '自贡', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  P(14, '成都', '成都', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  rail(15, '天府站', '天府站'),
  P(16, '烟台', '烟台', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  { id: 17, name: '公益基金', short: '公益', type: 'chest' },
  P(18, '济南', '济南', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  P(19, '青岛', '青岛', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
  { id: 20, name: '免费停车', short: '停车', type: 'parking' },
  P(21, '温州', '温州', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  { id: 22, name: '机会', short: '机会', type: 'chance' },
  P(23, '宁波', '宁波', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  P(24, '杭州', '杭州', 'red', 240, [20, 100, 300, 750, 925, 1100]),
  rail(25, '南京南站', '南京南站'),
  P(26, '扬州', '扬州', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  P(27, '苏州', '苏州', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility(28, '自来水厂', '自来水厂'),
  P(29, '南京', '南京', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
  { id: 30, name: '进监狱', short: '入狱', type: 'gotojail' },
  P(31, '广州', '广州', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  P(32, '深圳', '深圳', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  { id: 33, name: '公益基金', short: '公益', type: 'chest' },
  P(34, '香港', '香港', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
  rail(35, '上海虹桥', '上海虹桥'),
  { id: 36, name: '机会', short: '机会', type: 'chance' },
  P(37, '北京', '北京', 'navy', 350, [35, 175, 500, 1100, 1300, 1500]),
  { id: 38, name: '奢侈税', short: '奢侈税', type: 'tax', tax: 100 },
  P(39, '上海', '上海', 'navy', 400, [50, 200, 600, 1400, 1700, 2000]),
]

export const RAILROAD_IDS = [5, 15, 25, 35]
export const UTILITY_IDS = [11, 28]

export function spacesInGroup(group: GroupId): Space[] {
  return SPACES.filter((s) => s.group === group)
}

export function isDeed(space: Space): boolean {
  return space.type === 'property' || space.type === 'railroad' || space.type === 'utility'
}
