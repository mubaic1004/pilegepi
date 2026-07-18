export type PetType =
  | 'cat'
  | 'dog'
  | 'rabbit'
  | 'panda'
  | 'hamster'
  | 'fox'
  | 'frog'
  | 'duck'
  | 'penguin'
  | 'alpaca'
  | 'seal'
  | 'bear'

export type TileSource = 'board' | 'leftDeck' | 'rightDeck'
export type TileState = 'board' | 'slot' | 'holding' | 'removed'

export interface Tile {
  id: string
  type: PetType
  x: number
  y: number
  layer: number
  source: TileSource
  stackIndex: number
  state: TileState
  coveredBy: string[]
}

export interface ToolCounts {
  undo: number
  moveOut: number
  shuffle: number
}

export interface LevelConfig {
  id: 1 | 2
  name: string
  subtitle: string
  iconPool: PetType[]
  centralLayerCounts: number[]
  sideDeckCount: number
  slotCapacity: number
  copiesPerType: number
  toolCounts: ToolCounts
  randomStrategy: 'tutorial' | 'high-variance'
  tutorialPicks: number
}

export interface MoveHistoryEntry {
  tileId: string
  previousSource: TileSource
  previousStackIndex: number
}

export type GameStatus = 'playing' | 'paused' | 'won' | 'lost'

export interface GameState {
  level: LevelConfig
  seed: number
  tiles: Tile[]
  slotIds: string[]
  holdingIds: string[]
  lastMove: MoveHistoryEntry | null
  status: GameStatus
  tools: ToolCounts
  combo: number
  score: number
  removedCount: number
  tutorialPicksLeft: number
}

export interface TakeResult {
  accepted: boolean
  clearedIds: string[]
  rescued: boolean
  won: boolean
  lost: boolean
}

export interface SaveData {
  unlockedLevel: 1 | 2
  bestScore: number | null
  muted: boolean
}
