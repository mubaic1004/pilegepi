import type { Tile } from './types'

const OVERLAP_EPSILON = 0.04

export function tilesOverlap(first: Pick<Tile, 'x' | 'y'>, second: Pick<Tile, 'x' | 'y'>): boolean {
  return Math.abs(first.x - second.x) < 1 - OVERLAP_EPSILON
    && Math.abs(first.y - second.y) < 1 - OVERLAP_EPSILON
}

export function attachCoveringRelationships(tiles: Tile[]): Tile[] {
  const central = tiles.filter((tile) => tile.source === 'board')
  for (const tile of central) {
    tile.coveredBy = central
      .filter((candidate) => candidate.layer > tile.layer && tilesOverlap(tile, candidate))
      .map((candidate) => candidate.id)
  }
  return tiles
}

export function topDeckTile(tiles: Tile[], source: 'leftDeck' | 'rightDeck'): Tile | null {
  const remaining = tiles.filter((tile) => tile.source === source && tile.state === 'board')
  if (remaining.length === 0) return null
  return remaining.reduce((top, tile) => tile.stackIndex > top.stackIndex ? tile : top)
}

export function isTileAvailable(tile: Tile, tiles: Tile[]): boolean {
  if (tile.state !== 'board') return false
  if (tile.source === 'leftDeck' || tile.source === 'rightDeck') {
    return topDeckTile(tiles, tile.source)?.id === tile.id
  }
  const byId = new Map(tiles.map((candidate) => [candidate.id, candidate]))
  return tile.coveredBy.every((id) => byId.get(id)?.state !== 'board')
}

export function getAvailableTiles(tiles: Tile[]): Tile[] {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]))
  const central = tiles.filter((tile) => tile.source === 'board' && tile.state === 'board' && tile.coveredBy.every((id) => byId.get(id)?.state !== 'board'))
  const left = topDeckTile(tiles, 'leftDeck')
  const right = topDeckTile(tiles, 'rightDeck')
  return [...central, ...(left ? [left] : []), ...(right ? [right] : [])]
}
