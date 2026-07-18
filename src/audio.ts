type SoundName = 'tap' | 'match' | 'miss' | 'shuffle' | 'win' | 'lose'

const NOTES: Record<SoundName, number[]> = {
  tap: [480],
  match: [620, 840],
  miss: [190],
  shuffle: [340, 420, 520],
  win: [523, 659, 784, 1046],
  lose: [330, 277, 220],
}

export class GameAudio {
  private context: AudioContext | null = null
  private muted: boolean

  constructor(muted: boolean) {
    this.muted = muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  play(name: SoundName): void {
    if (this.muted) return
    const AudioContextClass = window.AudioContext
    this.context ??= new AudioContextClass()
    const context = this.context
    void context.resume()
    NOTES[name].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const start = context.currentTime + index * 0.075
      oscillator.type = name === 'lose' || name === 'miss' ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.075, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.18)
    })
  }
}
