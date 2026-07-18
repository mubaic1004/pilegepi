import { LEVELS } from './levels'
import { mulberry32, shuffle, type RandomSource } from './random'
import { attachCoveringRelationships, getAvailableTiles, isTileAvailable } from './stack'
import type { GameState, LevelConfig, PetType, TakeResult, Tile, TileSource } from './types'

interface Position {
  x: number
  y: number
  layer: number
  source: TileSource
  stackIndex: number
}

function tutorialPositions(): Position[] {
  const positions: Position[] = []
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      positions.push({ x: 1.5 + col, y: 2.8 + row, layer: 0, source: 'board', stackIndex: 0 })
    }
  }
  const top = [
    [1.45, 1.35], [2.65, 1.35], [3.85, 1.35],
    [2.05, 2.2], [3.25, 2.2], [4.45, 2.2],
  ]
  top.forEach(([x, y]) => positions.push({ x, y, layer: 1, source: 'board', stackIndex: 0 }))
  return positions
}

function challengePositions(sideDeckCount: number): Position[] {
  const positions: Position[] = []
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      if ((x === 0 || x === 6) && (y === 0 || y === 6)) continue
      positions.push({ x, y, layer: 0, source: 'board', stackIndex: 0 })
    }
  }
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      positions.push({ x: x + 0.5, y: y + 0.5, layer: 1, source: 'board', stackIndex: 0 })
    }
  }
  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 5; x += 1) {
      if (x === 3 && y === 3) continue
      positions.push({ x, y, layer: 2, source: 'board', stackIndex: 0 })
    }
  }
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      positions.push({ x, y, layer: 3, source: 'board', stackIndex: 0 })
    }
  }
  for (let index = 0; index < sideDeckCount; index += 1) {
    positions.push({ x: -1, y: 5.7, layer: 10, source: 'leftDeck', stackIndex: index })
    positions.push({ x: 7, y: 5.7, layer: 10, source: 'rightDeck', stackIndex: index })
  }
  return positions
}

function tutorialTypes(level: LevelConfig): PetType[] {
  const [cat, dog, rabbit, panda, hamster, fox] = level.iconPool
  return [
    rabbit, rabbit, rabbit, panda, panda, panda,
    hamster, hamster, hamster, fox, fox, fox,
    cat, cat, cat, dog, dog, dog,
  ]
}

function challengeTypes(level: LevelConfig, random: RandomSource): PetType[] {
  const types = level.iconPool.flatMap((type) => Array<PetType>(level.copiesPerType).fill(type))
  return shuffle(types, random)
}

export function generateBoard(level: LevelConfig, seed: number): Tile[] {
  const random = mulberry32(seed)
  const positions = level.randomStrategy === 'tutorial' ? tutorialPositions() : challengePositions(level.sideDeckCount)
  const types = level.randomStrategy === 'tutorial' ? tutorialTypes(level) : challengeTypes(level, random)
  if (positions.length !== types.length) throw new Error(`Layout has ${positions.length} positions for ${types.length} tiles`)
  const tiles = positions.map((position, index): Tile => ({
    id: `${level.id}-${index}`,
    type: types[index],
    ...position,
    state: 'board',
    coveredBy: [],
  }))
  return attachCoveringRelationships(tiles)
}

export function createGameState(levelId: 1 | 2, seed: number): GameState {
  const level = LEVELS[levelId]
  return {
    level,
    seed,
    tiles: generateBoard(level, seed),
    slotIds: [],
    holdingIds: [],
    lastMove: null,
    status: 'playing',
    tools: { ...level.toolCounts },
    combo: 0,
    score: 0,
    removedCount: 0,
    tutorialPicksLeft: level.tutorialPicks,
  }
}

function tileById(state: GameState, id: string): Tile {
  const tile = state.tiles.find((candidate) => candidate.id === id)
  if (!tile) throw new Error(`Unknown tile ${id}`)
  return tile
}

function insertGrouped(state: GameState, tileId: string): void {
  const tile = tileById(state, tileId)
  const sameIndexes = state.slotIds
    .map((id, index) => tileById(state, id).type === tile.type ? index : -1)
    .filter((index) => index >= 0)
  const insertAt = sameIndexes.length > 0 ? Math.max(...sameIndexes) + 1 : state.slotIds.length
  state.slotIds.splice(insertAt, 0, tileId)
  tile.state = 'slot'
}

function resolveTriple(state: GameState, type: PetType): string[] {
  const matching = state.slotIds.filter((id) => tileById(state, id).type === type)
  if (matching.length < 3) return []
  const cleared = matching.slice(0, 3)
  const clearedSet = new Set(cleared)
  state.slotIds = state.slotIds.filter((id) => !clearedSet.has(id))
  cleared.forEach((id) => { tileById(state, id).state = 'removed' })
  state.removedCount += 3
  state.combo += 1
  state.score += 300 * state.combo
  return cleared
}

function allCleared(state: GameState): boolean {
  return state.tiles.every((tile) => tile.state === 'removed')
}

function rescueTutorial(state: GameState): void {
  state.slotIds.forEach((id) => { tileById(state, id).state = 'board' })
  state.slotIds = []
  state.lastMove = null
  state.combo = 0
  const boardTiles = state.tiles.filter((tile) => tile.state === 'board')
  const mixed = shuffle(boardTiles.map((tile) => tile.type), mulberry32((state.seed ^ state.removedCount ^ 0xa53c9e) >>> 0))
  boardTiles.forEach((tile, index) => { tile.type = mixed[index] })
}

export function takeTile(state: GameState, tileId: string): TakeResult {
  const emptyResult: TakeResult = { accepted: false, clearedIds: [], rescued: false, won: false, lost: false }
  if (state.status !== 'playing') return emptyResult
  const tile = tileById(state, tileId)
  if (!isTileAvailable(tile, state.tiles)) return emptyResult
  if (state.level.id === 1 && state.tutorialPicksLeft > 0 && tile.type !== 'cat') return emptyResult

  const previousSource = tile.source
  const previousStackIndex = tile.stackIndex
  insertGrouped(state, tileId)
  const clearedIds = resolveTriple(state, tile.type)
  state.tutorialPicksLeft = Math.max(0, state.tutorialPicksLeft - 1)
  state.lastMove = clearedIds.length > 0 ? null : { tileId, previousSource, previousStackIndex }

  if (allCleared(state)) {
    state.status = 'won'
    return { accepted: true, clearedIds, rescued: false, won: true, lost: false }
  }
  if (state.slotIds.length >= state.level.slotCapacity) {
    if (state.level.id === 1) {
      rescueTutorial(state)
      return { accepted: true, clearedIds, rescued: true, won: false, lost: false }
    }
    state.status = 'lost'
    return { accepted: true, clearedIds, rescued: false, won: false, lost: true }
  }
  if (clearedIds.length === 0) state.combo = 0
  return { accepted: true, clearedIds, rescued: false, won: false, lost: false }
}

export function undoLastMove(state: GameState): boolean {
  if (state.status !== 'playing' || state.tools.undo <= 0 || !state.lastMove) return false
  const tile = tileById(state, state.lastMove.tileId)
  if (tile.state !== 'slot') return false
  state.slotIds = state.slotIds.filter((id) => id !== tile.id)
  tile.state = 'board'
  tile.source = state.lastMove.previousSource
  tile.stackIndex = state.lastMove.previousStackIndex
  state.lastMove = null
  state.tools.undo -= 1
  state.combo = 0
  return true
}

export function moveOutSlot(state: GameState): string[] {
  if (state.status !== 'playing' || state.tools.moveOut <= 0 || state.slotIds.length === 0) return []
  const moved = state.slotIds.slice(0, 3)
  state.slotIds = state.slotIds.slice(moved.length)
  moved.forEach((id) => {
    tileById(state, id).state = 'holding'
    state.holdingIds.push(id)
  })
  state.tools.moveOut -= 1
  state.lastMove = null
  state.combo = 0
  return moved
}

export function returnHoldingTile(state: GameState, tileId: string): TakeResult {
  const emptyResult: TakeResult = { accepted: false, clearedIds: [], rescued: false, won: false, lost: false }
  if (state.status !== 'playing' || !state.holdingIds.includes(tileId)) return emptyResult
  state.holdingIds = state.holdingIds.filter((id) => id !== tileId)
  const tile = tileById(state, tileId)
  insertGrouped(state, tileId)
  const clearedIds = resolveTriple(state, tile.type)
  state.lastMove = null
  if (allCleared(state)) {
    state.status = 'won'
    return { accepted: true, clearedIds, rescued: false, won: true, lost: false }
  }
  if (state.slotIds.length >= state.level.slotCapacity) {
    state.status = 'lost'
    return { accepted: true, clearedIds, rescued: false, won: false, lost: true }
  }
  return { accepted: true, clearedIds, rescued: false, won: false, lost: false }
}

export function shuffleBoard(state: GameState, salt = 1): boolean {
  if (state.status !== 'playing' || state.tools.shuffle <= 0) return false
  const boardTiles = state.tiles.filter((tile) => tile.state === 'board')
  const random = mulberry32((state.seed ^ (salt * 0x9e3779b9)) >>> 0)
  const types = shuffle(boardTiles.map((tile) => tile.type), random)
  boardTiles.forEach((tile, index) => { tile.type = types[index] })
  state.tools.shuffle -= 1
  state.lastMove = null
  state.combo = 0
  return true
}

export function availableTiles(state: GameState): Tile[] {
  return getAvailableTiles(state.tiles)
}

export function typeCountsAreTriples(tiles: Tile[]): boolean {
  const counts = new Map<PetType, number>()
  tiles.forEach((tile) => counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1))
  return [...counts.values()].every((count) => count % 3 === 0)
}
