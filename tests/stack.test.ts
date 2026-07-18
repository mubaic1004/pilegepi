import { describe, expect, it } from 'vitest'
import { createGameState } from '../src/board'
import { getAvailableTiles, isTileAvailable, tilesOverlap, topDeckTile } from '../src/stack'
import type { Tile } from '../src/types'

describe('叠层遮挡与盲盒', () => {
  it('正确识别几何重叠', () => {
    expect(tilesOverlap({ x: 1, y: 1 }, { x: 1.5, y: 1.5 })).toBe(true)
    expect(tilesOverlap({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(false)
  })

  it('顶层牌可点击，被覆盖牌不可点击，移除遮挡后解锁', () => {
    const state = createGameState(2, 11)
    const top = state.tiles.find((tile) => tile.source === 'board' && tile.layer === 3)!
    const covered = state.tiles.find((tile) => tile.source === 'board' && tile.coveredBy.includes(top.id))!
    expect(isTileAvailable(top, state.tiles)).toBe(true)
    expect(isTileAvailable(covered, state.tiles)).toBe(false)
    covered.coveredBy.forEach((id) => { state.tiles.find((tile) => tile.id === id)!.state = 'removed' })
    expect(isTileAvailable(covered, state.tiles)).toBe(true)
  })

  it('每个盲盒只有最上方一张可点击', () => {
    const state = createGameState(2, 22)
    const left = state.tiles.filter((tile) => tile.source === 'leftDeck')
    const top = topDeckTile(state.tiles, 'leftDeck')!
    expect(top.stackIndex).toBe(14)
    expect(isTileAvailable(top, state.tiles)).toBe(true)
    expect(left.filter((tile) => tile.id !== top.id).every((tile) => !isTileAvailable(tile, state.tiles))).toBe(true)
    top.state = 'slot'
    expect(topDeckTile(state.tiles, 'leftDeck')?.stackIndex).toBe(13)
  })

  it('第二关开局只有顶层牌和两个盲盒顶牌可用', () => {
    const state = createGameState(2, 33)
    const available = getAvailableTiles(state.tiles)
    expect(available.filter((tile) => tile.source === 'board').length).toBeGreaterThanOrEqual(9)
    expect(available.filter((tile) => tile.source !== 'board')).toHaveLength(2)
  })

  it('图块保存了覆盖依赖而不是运行时猜测层级', () => {
    const state = createGameState(2, 44)
    const lower = state.tiles.filter((tile): tile is Tile => tile.source === 'board' && tile.layer === 0)
    expect(lower.some((tile) => tile.coveredBy.length > 0)).toBe(true)
  })
})
