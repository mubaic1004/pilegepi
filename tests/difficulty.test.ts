import { describe, expect, it } from 'vitest'
import { availableTiles, createGameState, moveOutSlot, returnHoldingTile, shuffleBoard, takeTile, undoLastMove } from '../src/board'
import { mulberry32 } from '../src/random'
import type { GameState, PetType, Tile } from '../src/types'

function chooseTile(state: GameState, random: () => number): Tile | null {
  const available = availableTiles(state)
  if (available.length === 0) return null
  const slotCounts = new Map<PetType, number>()
  state.slotIds.forEach((id) => {
    const type = state.tiles.find((tile) => tile.id === id)!.type
    slotCounts.set(type, (slotCounts.get(type) ?? 0) + 1)
  })
  const ranked = available.map((tile) => ({
    tile,
    score: (slotCounts.get(tile.type) ?? 0) * 100
      + tile.coveredBy.filter((id) => state.tiles.find((candidate) => candidate.id === id)?.state === 'board').length * 2
      + random(),
  })).sort((a, b) => b.score - a.score)
  return ranked[0].tile
}

function tryHoldingMatch(state: GameState): boolean {
  const counts = new Map<PetType, number>()
  state.slotIds.forEach((id) => {
    const type = state.tiles.find((tile) => tile.id === id)!.type
    counts.set(type, (counts.get(type) ?? 0) + 1)
  })
  const held = state.holdingIds.find((id) => counts.get(state.tiles.find((tile) => tile.id === id)!.type) === 2)
  if (!held) return false
  returnHoldingTile(state, held)
  return true
}

function simulate(seed: number): boolean {
  const state = createGameState(2, seed)
  const random = mulberry32(seed ^ 0x51f15e)
  let safety = 0
  while (state.status === 'playing' && safety++ < 300) {
    if (tryHoldingMatch(state)) continue
    const choice = chooseTile(state, random)
    if (!choice) {
      const held = state.holdingIds
        .map((id) => state.tiles.find((tile) => tile.id === id)!)
        .sort((a, b) => {
          const count = (type: PetType) => state.slotIds
            .filter((id) => state.tiles.find((tile) => tile.id === id)!.type === type).length
          return count(b.type) - count(a.type)
        })[0]
      if (!held) return false
      returnHoldingTile(state, held.id)
      continue
    }
    const slotCounts = new Map<PetType, number>()
    state.slotIds.forEach((id) => {
      const type = state.tiles.find((tile) => tile.id === id)!.type
      slotCounts.set(type, (slotCounts.get(type) ?? 0) + 1)
    })
    const willClear = (slotCounts.get(choice.type) ?? 0) === 2
    if (state.slotIds.length === 6 && !willClear) {
      if (state.tools.moveOut > 0) {
        moveOutSlot(state)
        continue
      }
      if (state.tools.shuffle > 0) {
        shuffleBoard(state, seed + safety)
        continue
      }
      if (state.tools.undo > 0 && state.lastMove) {
        undoLastMove(state)
        continue
      }
    }
    takeTile(state, choice.id)
  }
  return state.status === 'won'
}

describe('第二关难度抽样', () => {
  it('1000个固定种子的启发式通关率处于1%至3%', () => {
    const sampleSize = Number(process.env.SAMPLES ?? 1000)
    let wins = 0
    for (let seed = 1; seed <= sampleSize; seed += 1) {
      if (simulate(seed)) wins += 1
    }
    const winRate = wins / sampleSize
    console.info(`stack-mode heuristic clear rate: ${(winRate * 100).toFixed(1)}% (${wins}/${sampleSize})`)
    if (sampleSize >= 1000) {
      expect(winRate).toBeGreaterThanOrEqual(0.01)
      expect(winRate).toBeLessThanOrEqual(0.03)
    }
  }, 120_000)
})
