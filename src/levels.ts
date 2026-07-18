import type { LevelConfig, PetType } from './types'

export const PETS: PetType[] = [
  'cat', 'dog', 'rabbit', 'panda', 'hamster', 'fox',
  'frog', 'duck', 'penguin', 'alpaca', 'seal', 'bear',
]

export const PET_NAMES: Record<PetType, string> = {
  cat: '皮皮猫',
  dog: '软糖狗',
  rabbit: '团子兔',
  panda: '糯米熊猫',
  hamster: '瓜子仓鼠',
  fox: '桃桃狐',
  frog: '薄荷蛙',
  duck: '布丁鸭',
  penguin: '芝麻企鹅',
  alpaca: '云朵羊驼',
  seal: '泡泡海豹',
  bear: '焦糖小熊',
}

export const LEVELS: Record<1 | 2, LevelConfig> = {
  1: {
    id: 1,
    name: '热身局',
    subtitle: '三只一样，一起皮走',
    iconPool: PETS.slice(0, 6),
    centralLayerCounts: [12, 6],
    sideDeckCount: 0,
    slotCapacity: 7,
    copiesPerType: 3,
    toolCounts: { undo: 0, moveOut: 0, shuffle: 0 },
    randomStrategy: 'tutorial',
    tutorialPicks: 3,
  },
  2: {
    id: 2,
    name: '这才是正片',
    subtitle: '挖开叠层，别让卡槽塞满',
    iconPool: PETS,
    centralLayerCounts: [45, 36, 24, 9],
    sideDeckCount: 15,
    slotCapacity: 7,
    copiesPerType: 12,
    toolCounts: { undo: 1, moveOut: 1, shuffle: 1 },
    randomStrategy: 'high-variance',
    tutorialPicks: 0,
  },
}
