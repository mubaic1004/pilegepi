import type { SaveData } from './types'

const SAVE_KEY = 'pi-le-ge-pi-save-v1'

const DEFAULT_SAVE: SaveData = {
  unlockedLevel: 1,
  bestScore: null,
  muted: false,
}

export function loadSave(): SaveData {
  try {
    const value = localStorage.getItem(SAVE_KEY)
    if (!value) return { ...DEFAULT_SAVE }
    const parsed = JSON.parse(value) as Partial<SaveData>
    return {
      unlockedLevel: parsed.unlockedLevel === 2 ? 2 : 1,
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : null,
      muted: Boolean(parsed.muted),
    }
  } catch {
    return { ...DEFAULT_SAVE }
  }
}

export function saveProgress(save: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    // The game remains fully playable when private browsing blocks storage.
  }
}
