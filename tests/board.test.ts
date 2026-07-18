import { describe, expect, it } from 'vitest'
import {
  availableTiles,
  createGameState,
  moveOutSlot,
  returnHoldingTile,
  shuffleBoard,
  takeTile,
  typeCountsAreTriples,
  undoLastMove,
} from '../src/board'
import type { PetType } from '../src/types'

describe('七格槽位三消', () => {
  it('三张相同牌进入槽位后自动消除', () => {
    const state = createGameState(1, 1)
    const cats = availableTiles(state).filter((tile) => tile.type === 'cat')
    expect(cats).toHaveLength(3)
    cats.forEach((tile) => takeTile(state, tile.id))
    expect(state.slotIds).toHaveLength(0)
    expect(state.removedCount).toBe(3)
    expect(cats.every((tile) => tile.state === 'removed')).toBe(true)
  })

  it('第二关槽位留下七张不同类型时失败', () => {
    const state = createGameState(2, 2)
    const types: PetType[] = ['cat', 'dog', 'rabbit', 'panda', 'hamster', 'fox', 'frog']
    for (const type of types) {
      const tile = availableTiles(state)[0]
      tile.type = type
      takeTile(state, tile.id)
    }
    expect(state.slotIds).toHaveLength(7)
    expect(state.status).toBe('lost')
  })

  it('撤回将最近一张未消除牌送回原位置', () => {
    const state = createGameState(2, 3)
    const tile = availableTiles(state)[0]
    takeTile(state, tile.id)
    expect(tile.state).toBe('slot')
    expect(undoLastMove(state)).toBe(true)
    expect(tile.state).toBe('board')
    expect(state.slotIds).toHaveLength(0)
    expect(state.tools.undo).toBe(0)
  })

  it('发生三消后不可撤回', () => {
    const state = createGameState(2, 4)
    const available = availableTiles(state).slice(0, 3)
    available.forEach((tile) => { tile.type = 'cat' })
    available.forEach((tile) => takeTile(state, tile.id))
    expect(state.lastMove).toBeNull()
    expect(undoLastMove(state)).toBe(false)
  })

  it('移出最多三张并可逐张放回触发三消', () => {
    const state = createGameState(2, 5)
    const picked = availableTiles(state).slice(0, 3)
    picked.forEach((tile, index) => { tile.type = (['cat', 'dog', 'rabbit'] as PetType[])[index] })
    picked.forEach((tile) => takeTile(state, tile.id))
    expect(moveOutSlot(state)).toHaveLength(3)
    expect(state.slotIds).toHaveLength(0)
    expect(state.holdingIds).toHaveLength(3)

    const catId = state.holdingIds.find((id) => state.tiles.find((tile) => tile.id === id)!.type === 'cat')!
    const boardCats = availableTiles(state).slice(0, 2)
    boardCats.forEach((tile) => { tile.type = 'cat' })
    boardCats.forEach((tile) => takeTile(state, tile.id))
    const result = returnHoldingTile(state, catId)
    expect(result.clearedIds).toHaveLength(3)
    expect(state.holdingIds).not.toContain(catId)
  })

  it('洗牌只改变场上图案，不改变位置层级与牌数', () => {
    const state = createGameState(2, 6)
    const beforeGeometry = state.tiles.map(({ id, x, y, layer, source, stackIndex, state: tileState }) => ({ id, x, y, layer, source, stackIndex, tileState }))
    const beforeTypes = state.tiles.filter((tile) => tile.state === 'board').map((tile) => tile.type).sort()
    expect(shuffleBoard(state, 1)).toBe(true)
    const afterGeometry = state.tiles.map(({ id, x, y, layer, source, stackIndex, state: tileState }) => ({ id, x, y, layer, source, stackIndex, tileState }))
    const afterTypes = state.tiles.filter((tile) => tile.state === 'board').map((tile) => tile.type).sort()
    expect(afterGeometry).toEqual(beforeGeometry)
    expect(afterTypes).toEqual(beforeTypes)
    expect(state.tools.shuffle).toBe(0)
  })

  it('所有关卡图案总数均为三的倍数', () => {
    expect(typeCountsAreTriples(createGameState(1, 7).tiles)).toBe(true)
    for (let seed = 1; seed <= 100; seed += 1) {
      expect(typeCountsAreTriples(createGameState(2, seed).tiles)).toBe(true)
    }
  })

  it('第一关能按教学顺序稳定通关', () => {
    const state = createGameState(1, 8)
    let rounds = 0
    while (state.status === 'playing' && rounds++ < 20) {
      const available = availableTiles(state)
      const grouped = new Map<PetType, typeof available>()
      available.forEach((tile) => grouped.set(tile.type, [...(grouped.get(tile.type) ?? []), tile]))
      const triple = state.tutorialPicksLeft > 0
        ? grouped.get('cat')
        : [...grouped.values()].find((tiles) => tiles.length >= 3)
      expect(triple).toBeDefined()
      triple!.slice(0, 3).forEach((tile) => takeTile(state, tile.id))
    }
    expect(rounds).toBeLessThan(20)
    expect(state.status).toBe('won')
    expect(state.removedCount).toBe(18)
  })
})
