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
  P(1, '地中海大街', '地中海', 'brown', 60, [2, 10, 30, 90, 160, 250]),
  { id: 2, name: '公益基金', short: '公益', type: 'chest' },
  P(3, '波罗的海大道', '波罗的', 'brown', 60, [4, 20, 60, 180, 320, 450]),
  { id: 4, name: '所得税', short: '所得税', type: 'tax', tax: 200 },
  rail(5, '北站铁路', '北站'),
  P(6, '东方大道', '东方', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  { id: 7, name: '机会', short: '机会', type: 'chance' },
  P(8, '佛蒙特大道', '佛蒙特', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  P(9, '康涅狄格大道', '康州', 'lightblue', 120, [8, 40, 100, 300, 450, 600]),
  { id: 10, name: '监狱', short: '监狱', type: 'jail' },
  P(11, '圣查尔斯广场', '圣查尔斯', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  utility(12, '电力公司', '电力'),
  P(13, '州府广场', '州府', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  P(14, '弗吉尼亚大道', '弗吉尼亚', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  rail(15, '东站铁路', '东站'),
  P(16, '圣詹姆斯广场', '圣詹姆斯', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  { id: 17, name: '公益基金', short: '公益', type: 'chest' },
  P(18, '田纳西大道', '田纳西', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  P(19, '纽约大道', '纽约', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
  { id: 20, name: '免费停车', short: '停车', type: 'parking' },
  P(21, '肯塔基大道', '肯塔基', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  { id: 22, name: '机会', short: '机会', type: 'chance' },
  P(23, '印第安纳大道', '印第安纳', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  P(24, '伊利诺伊大道', '伊利诺伊', 'red', 240, [20, 100, 300, 750, 925, 1100]),
  rail(25, '南站铁路', '南站'),
  P(26, '大西洋大道', '大西洋', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  P(27, '文特诺大道', '文特诺', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility(28, '自来水厂', '水厂'),
  P(29, '马文花园', '马文', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
  { id: 30, name: '进监狱', short: '入狱', type: 'gotojail' },
  P(31, '太平洋大道', '太平洋', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  P(32, '北卡罗来纳大道', '北卡', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  { id: 33, name: '公益基金', short: '公益', type: 'chest' },
  P(34, '宾夕法尼亚大道', '宾州', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
  rail(35, '西站铁路', '西站'),
  { id: 36, name: '机会', short: '机会', type: 'chance' },
  P(37, '公园广场', '公园', 'navy', 350, [35, 175, 500, 1100, 1300, 1500]),
  { id: 38, name: '奢侈税', short: '奢侈税', type: 'tax', tax: 100 },
  P(39, '木板路', '木板路', 'navy', 400, [50, 200, 600, 1400, 1700, 2000]),
]

export const RAILROAD_IDS = [5, 15, 25, 35]
export const UTILITY_IDS = [12, 28]

export function spacesInGroup(group: GroupId): Space[] {
  return SPACES.filter((s) => s.group === group)
}

export function isDeed(space: Space): boolean {
  return space.type === 'property' || space.type === 'railroad' || space.type === 'utility'
}
