import './style.css'
import { GameAudio } from './audio'
import {
  availableTiles,
  createGameState,
  moveOutSlot,
  returnHoldingTile,
  shuffleBoard,
  takeTile,
  undoLastMove,
} from './board'
import { PET_NAMES } from './levels'
import { createSeed } from './random'
import { loadSave, saveProgress } from './storage'
import type { GameState, PetType, SaveData, TakeResult, Tile } from './types'

const app = document.querySelector<HTMLDivElement>('#app')!
let save: SaveData = loadSave()
const audio = new GameAudio(save.muted)
let state: GameState | null = null
let shuffleSalt = 0
let toastTimer: number | null = null

const PET_FALLBACKS: Record<PetType, string> = {
  cat: '🐱', dog: '🐶', rabbit: '🐰', panda: '🐼', hamster: '🐹', fox: '🦊',
  frog: '🐸', duck: '🐥', penguin: '🐧', alpaca: '🦙', seal: '🦭', bear: '🐻',
}

function iconMarkup(type: PetType, className = ''): string {
  return `<span class="pet-art ${className}"><img src="./assets/pets/${type}.webp" alt="" draggable="false" onerror="this.style.display='none'"><span class="pet-fallback">${PET_FALLBACKS[type]}</span></span>`
}

function toggleMute(): void {
  save.muted = !save.muted
  saveProgress(save)
  audio.setMuted(save.muted)
  document.querySelectorAll<HTMLElement>('[data-sound-icon]').forEach((icon) => {
    icon.textContent = save.muted ? '🔇' : '🔊'
  })
  if (!save.muted) audio.play('tap')
}

function homeScreen(): void {
  state = null
  app.innerHTML = `
    <main class="home-screen">
      <button class="sound-fab" data-action="sound" aria-label="${save.muted ? '打开声音' : '关闭声音'}"><span data-sound-icon>${save.muted ? '🔇' : '🔊'}</span></button>
      <div class="sky-blob sky-blob-one"></div><div class="sky-blob sky-blob-two"></div>
      <section class="hero-card">
        <span class="eyebrow">萌宠叠牌三消</span>
        <div class="mascot-wrap">
          <span class="mascot-rays"></span>${iconMarkup('cat', 'mascot')}
          <span class="mascot-bubble">三只一起皮！</span>
        </div>
        <h1><span>皮</span>了个<span>皮</span></h1>
        <p>叠牌挖到底，三只一起皮</p>
        <button class="primary-button" data-action="start-1">开始皮一下 <span>→</span></button>
        ${save.unlockedLevel === 2 ? '<button class="secondary-button" data-action="start-2">⚡ 直接挑战第二关</button>' : '<div class="locked-note">🔒 通关热身局，解锁真正挑战</div>'}
      </section>
      <footer class="home-footer">原创萌宠 · 七格卡槽 · 高能第二关</footer>
    </main>`
}

function startLevel(levelId: 1 | 2): void {
  state = createGameState(levelId, createSeed())
  shuffleSalt = 0
  renderGame()
  if (levelId === 1) showToast('先点亮着的皮皮猫，凑齐三只')
}

function gameHeader(current: GameState): string {
  return `<header class="game-header">
    <button class="icon-button" data-action="home" aria-label="返回首页">‹</button>
    <div class="level-copy"><small>第 ${current.level.id} 关</small><strong>${current.level.name}</strong></div>
    <div class="header-actions">
      <div class="score-pill"><span>⭐</span><strong>${current.score}</strong></div>
      <button class="icon-button" data-action="restart" aria-label="重新开始">↻</button>
      <button class="icon-button" data-action="sound" aria-label="${save.muted ? '打开声音' : '关闭声音'}"><span data-sound-icon>${save.muted ? '🔇' : '🔊'}</span></button>
    </div>
  </header>`
}

function renderGame(): void {
  if (!state) return
  const current = state
  const availableIds = new Set(availableTiles(current).map((tile) => tile.id))
  const tutorialTargetId = current.level.id === 1 && current.tutorialPicksLeft > 0
    ? availableTiles(current).find((tile) => tile.type === 'cat')?.id
    : undefined
  const remaining = current.tiles.length - current.removedCount
  const progress = current.removedCount / current.tiles.length * 100
  app.innerHTML = `<main class="game-screen level-${current.level.id}">
    ${gameHeader(current)}
    <section class="game-copy">
      <div><h2>${current.level.subtitle}</h2><p>随机种子 #${current.seed.toString(16).toUpperCase()}</p></div>
      <div class="progress-copy"><strong>${remaining}</strong><span>/ ${current.tiles.length} 张</span></div>
    </section>
    <div class="progress-track"><span style="width:${progress}%"></span></div>
    <section class="tower-stage" aria-label="叠层牌塔">
      <div class="central-tower">
        ${current.tiles.filter((tile) => tile.source === 'board' && tile.state === 'board').map((tile) => towerTileMarkup(tile, availableIds, tutorialTargetId)).join('')}
      </div>
      ${deckMarkup('leftDeck', '左侧盲盒', availableIds)}
      ${deckMarkup('rightDeck', '右侧盲盒', availableIds)}
      <div class="combo-pop" data-combo aria-live="polite"></div>
    </section>
    ${holdingMarkup()}
    <section class="slot-section" aria-label="七格卡槽">
      <div class="slot-label"><span>皮皮卡槽</span><small>${current.slotIds.length} / ${current.level.slotCapacity}</small></div>
      <div class="slot-tray danger-${Math.min(7, current.slotIds.length)}">${slotMarkup()}</div>
    </section>
    ${current.level.id === 2 ? toolsMarkup() : '<p class="tutorial-rule">点最上层亮着的牌，三张相同会自动消除</p>'}
    <div class="toast" data-toast role="status"></div>
  </main>`
}

function towerTileMarkup(tile: Tile, availableIds: Set<string>, tutorialTargetId?: string): string {
  const available = availableIds.has(tile.id)
  const tutorialTarget = tile.id === tutorialTargetId
  return `<button class="tower-tile ${available ? 'available' : 'covered'} ${tutorialTarget ? 'tutorial-target' : ''}"
    data-tower-tile="${tile.id}" style="--x:${tile.x};--y:${tile.y};--layer:${tile.layer}"
    aria-label="${available ? `可点击的${PET_NAMES[tile.type]}` : `被遮挡的${PET_NAMES[tile.type]}`}" ${available ? '' : 'disabled'}>
    ${iconMarkup(tile.type)}${tutorialTarget ? '<span class="finger">☝</span>' : ''}
  </button>`
}

function deckMarkup(source: 'leftDeck' | 'rightDeck', label: string, availableIds: Set<string>): string {
  if (!state) return ''
  const remaining = state.tiles.filter((tile) => tile.source === source && tile.state === 'board')
  if (remaining.length === 0) return `<div class="blind-deck ${source} empty"><span>空</span></div>`
  const top = remaining.reduce((candidate, tile) => tile.stackIndex > candidate.stackIndex ? tile : candidate)
  return `<button class="blind-deck ${source}" data-tower-tile="${top.id}" aria-label="${label}，剩余${remaining.length}张" ${availableIds.has(top.id) ? '' : 'disabled'}>
    <span class="deck-layers"></span><span class="deck-back">🐾</span><strong>${remaining.length}</strong><small>盲盒</small>
  </button>`
}

function slotMarkup(): string {
  if (!state) return ''
  return Array.from({ length: state.level.slotCapacity }, (_, index) => {
    const id = state!.slotIds[index]
    if (!id) return '<div class="slot-cell empty"><span></span></div>'
    const tile = state!.tiles.find((candidate) => candidate.id === id)!
    return `<div class="slot-cell filled" data-slot-tile="${id}" aria-label="卡槽中的${PET_NAMES[tile.type]}">${iconMarkup(tile.type)}</div>`
  }).join('')
}

function holdingMarkup(): string {
  if (!state || state.holdingIds.length === 0) return '<div class="holding-area hidden"></div>'
  return `<section class="holding-area" aria-label="临时移出区"><span>临时区</span><div>${state.holdingIds.map((id) => {
    const tile = state!.tiles.find((candidate) => candidate.id === id)!
    return `<button data-holding-tile="${id}" aria-label="将${PET_NAMES[tile.type]}放回卡槽">${iconMarkup(tile.type)}</button>`
  }).join('')}</div><small>点击可放回卡槽</small></section>`
}

function toolsMarkup(): string {
  if (!state) return ''
  const undoDisabled = state.tools.undo === 0 || !state.lastMove
  const moveDisabled = state.tools.moveOut === 0 || state.slotIds.length === 0
  return `<section class="tools" aria-label="游戏道具">
    ${toolButton('undo', '↶', '撤回', state.tools.undo, undoDisabled)}
    ${toolButton('move-out', '📤', '移出', state.tools.moveOut, moveDisabled)}
    ${toolButton('shuffle', '🔀', '洗牌', state.tools.shuffle, state.tools.shuffle === 0)}
  </section><p class="rule-tip">上层牌会挡住下层牌，盲盒在点击前不会露出图案</p>`
}

function toolButton(action: string, icon: string, label: string, count: number, disabled: boolean): string {
  return `<button class="tool-button" data-action="${action}" ${disabled ? 'disabled' : ''}><span class="tool-icon">${icon}</span><span>${label}</span><span class="tool-count">${count}</span></button>`
}

function handleTowerTile(tileId: string): void {
  if (!state || state.status !== 'playing') return
  const tile = state.tiles.find((candidate) => candidate.id === tileId)
  if (!tile) return
  const result = takeTile(state, tileId)
  if (!result.accepted) {
    if (state.level.id === 1 && state.tutorialPicksLeft > 0) showToast('先跟着手指，凑齐三只皮皮猫')
    else showToast('这张牌还被上层挡住了')
    audio.play('miss')
    return
  }
  audio.play(result.clearedIds.length > 0 ? 'match' : 'tap')
  if (result.clearedIds.length > 0 && 'vibrate' in navigator) navigator.vibrate(18)
  renderGame()
  handleTakeFeedback(result)
}

function handleHoldingTile(tileId: string): void {
  if (!state) return
  const result = returnHoldingTile(state, tileId)
  if (!result.accepted) return
  audio.play(result.clearedIds.length > 0 ? 'match' : 'tap')
  renderGame()
  handleTakeFeedback(result)
}

function handleTakeFeedback(result: TakeResult): void {
  if (result.rescued) showToast('教学关不会失败，皮皮猫帮你重新摆好了')
  else if (result.clearedIds.length > 0) showCombo(`三只一起皮！ +${300 * Math.max(1, state?.combo ?? 1)}`)
  if (result.won) finishGame(true)
  else if (result.lost) finishGame(false)
  else if (state?.level.id === 1 && state.tutorialPicksLeft > 0) showToast(`再点 ${state.tutorialPicksLeft} 只皮皮猫`)
  else if (state?.level.id === 1 && state.removedCount === 3) showToast('学会啦！现在把剩下的萌宠都消掉')
}

function useUndo(): void {
  if (!state || !undoLastMove(state)) return
  audio.play('shuffle')
  renderGame()
  showToast('刚才那张牌已经放回原位')
}

function useMoveOut(): void {
  if (!state) return
  const moved = moveOutSlot(state)
  if (moved.length === 0) return
  audio.play('shuffle')
  renderGame()
  showToast(`移出了 ${moved.length} 张牌，点击临时区可放回`)
}

function useShuffle(): void {
  if (!state || !shuffleBoard(state, ++shuffleSalt)) return
  audio.play('shuffle')
  renderGame()
  showToast('场上和盲盒里的萌宠已重新洗牌')
}

function showCombo(message: string): void {
  const combo = document.querySelector<HTMLElement>('[data-combo]')
  if (!combo) return
  combo.textContent = message
  combo.classList.add('show')
}

function showToast(message: string): void {
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  const toast = document.querySelector<HTMLElement>('[data-toast]')
  if (!toast) return
  toast.textContent = message
  toast.classList.add('show')
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1900)
}

function finishGame(won: boolean): void {
  if (!state) return
  if (won) {
    audio.play('win')
    if (state.level.id === 1) save.unlockedLevel = 2
    save.bestScore = Math.max(save.bestScore ?? 0, state.score)
    saveProgress(save)
  } else {
    audio.play('lose')
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 100])
  }
  showResult(won)
}

function showResult(won: boolean): void {
  if (!state) return
  const levelOneWin = won && state.level.id === 1
  const title = levelOneWin ? '热身结束！' : won ? '你真的皮到底了！' : '卡槽被塞满啦'
  const description = levelOneWin
    ? '三只相同就能消除，真正的叠牌挑战现在开始。'
    : won ? '牌塔、盲盒和卡槽全部清空！' : '别急着乱点，先看清上层牌下面压着什么。'
  const action = levelOneWin
    ? '<button class="primary-button" data-action="start-2">挑战第二关 ⚡</button>'
    : `<button class="primary-button" data-action="restart-level">${won ? '换个牌局再皮一次' : '换个牌局重新挑战'}</button>`
  app.insertAdjacentHTML('beforeend', `<div class="result-backdrop"><section class="result-card ${won ? 'win' : 'lose'}" role="dialog" aria-modal="true">
    <div class="result-sticker">${won ? '🏆' : '😿'}</div><span class="eyebrow">${won ? '通关成功' : '挑战失败'}</span>
    <h2>${title}</h2><p>${description}</p>
    <div class="result-stats"><span><strong>${state.removedCount}</strong>已消除</span><span><strong>${state.score}</strong>本局得分</span></div>
    ${action}<button class="text-button" data-action="home">返回首页</button>
  </section></div>`)
}

function pauseForVisibility(): void {
  if (document.hidden && state?.status === 'playing') {
    state.status = 'paused'
    app.insertAdjacentHTML('beforeend', `<div class="pause-backdrop"><section><span>🐾</span><h2>先歇一下</h2><p>牌塔已经替你保留好啦</p><button class="primary-button" data-action="resume">继续游戏</button></section></div>`)
  }
}

function resumeGame(): void {
  if (!state || state.status !== 'paused') return
  state.status = 'playing'
  document.querySelector('.pause-backdrop')?.remove()
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const towerTile = target.closest<HTMLElement>('[data-tower-tile]')
  if (towerTile?.dataset.towerTile) {
    handleTowerTile(towerTile.dataset.towerTile)
    return
  }
  const holdingTile = target.closest<HTMLElement>('[data-holding-tile]')
  if (holdingTile?.dataset.holdingTile) {
    handleHoldingTile(holdingTile.dataset.holdingTile)
    return
  }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
  if (!action) return
  switch (action) {
    case 'start-1': startLevel(1); break
    case 'start-2': startLevel(2); break
    case 'home': homeScreen(); break
    case 'sound': toggleMute(); break
    case 'undo': useUndo(); break
    case 'move-out': useMoveOut(); break
    case 'shuffle': useShuffle(); break
    case 'restart':
    case 'restart-level': if (state) startLevel(state.level.id); break
    case 'resume': resumeGame(); break
  }
})

document.addEventListener('visibilitychange', pauseForVisibility)
homeScreen()
