import type { MapId, Space } from '@shared/types.ts'

// Vite emits only the compact production PNGs, not the full-size art originals.
const images = import.meta.glob<string>('./assets/board-icons/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const PROPERTY_ICONS: Record<MapId, Record<number, string>> = {
  "china": {
    "1": "zh-jingdezhen",
    "3": "zh-nanchang",
    "6": "zh-huangshan",
    "8": "zh-maanshan",
    "9": "zh-hefei",
    "12": "zh-panzhihua",
    "13": "zh-zigong",
    "14": "zh-chengdu",
    "16": "zh-yantai",
    "18": "zh-jinan",
    "19": "zh-qingdao",
    "21": "zh-wenzhou",
    "23": "zh-ningbo",
    "24": "zh-hangzhou",
    "26": "zh-yangzhou",
    "27": "zh-suzhou",
    "29": "zh-nanjing",
    "31": "zh-guangzhou",
    "32": "zh-shenzhen",
    "34": "zh-hong-kong",
    "37": "zh-beijing",
    "39": "zh-shanghai"
  },
  "usa": {
    "1": "en-houston",
    "3": "en-dallas",
    "6": "en-orlando",
    "8": "en-tampa",
    "9": "en-miami",
    "12": "en-juneau",
    "13": "en-fairbanks",
    "14": "en-anchorage",
    "16": "en-carson-city",
    "18": "en-reno",
    "19": "en-las-vegas",
    "21": "en-hilo",
    "23": "en-kailua-kona",
    "24": "en-honolulu",
    "26": "en-spokane",
    "27": "en-tacoma",
    "29": "en-seattle",
    "31": "en-san-diego",
    "32": "en-san-francisco",
    "34": "en-los-angeles",
    "37": "en-washington-dc",
    "39": "en-new-york"
  }
}

const SHARED_ICONS: Record<number, string> = {
  "0": "shared-go",
  "2": "shared-chest",
  "4": "shared-income-tax",
  "7": "shared-chance",
  "10": "shared-jail",
  "11": "shared-electric",
  "17": "shared-chest",
  "20": "shared-parking",
  "22": "shared-chance",
  "28": "shared-water",
  "30": "shared-go-to-jail",
  "33": "shared-chest",
  "36": "shared-chance",
  "38": "shared-luxury-tax"
}

export function boardIcon(space: Space, mapId: MapId): string | undefined {
  const key = space.type === 'railroad'
    ? `${mapId === 'china' ? 'zh' : 'en'}-transport`
    : space.type === 'property'
      ? PROPERTY_ICONS[mapId][space.id]
      : SHARED_ICONS[space.id]
  return key ? images[`./assets/board-icons/${key}.png`] : undefined
}

