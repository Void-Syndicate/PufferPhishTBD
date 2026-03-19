/**
 * PufferChat Sound Effects Engine
 * AOL-inspired sound scheme with configurable playback
 */

export type SoundEvent = 
  | 'message-received'
  | 'message-sent' 
  | 'door-open'
  | 'door-close'
  | 'welcome'
  | 'notification'
  | 'error';

interface SoundConfig {
  enabled: boolean;
  volume: number;
}

const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!AudioCtx) return null;
  if (!audioContext) {
    audioContext = new AudioCtx();
  }
  return audioContext;
}

const SOUND_PROFILES: Record<SoundEvent, { freq: number; duration: number; type: OscillatorType; ramp?: boolean }> = {
  'message-received': { freq: 800, duration: 0.15, type: 'sine' },
  'message-sent': { freq: 600, duration: 0.1, type: 'sine' },
  'door-open': { freq: 440, duration: 0.3, type: 'triangle', ramp: true },
  'door-close': { freq: 330, duration: 0.25, type: 'triangle', ramp: true },
  'welcome': { freq: 523, duration: 0.5, type: 'sine', ramp: true },
  'notification': { freq: 880, duration: 0.2, type: 'square' },
  'error': { freq: 200, duration: 0.3, type: 'sawtooth' },
};

class SoundEngine {
  private globalMute = false;
  private globalVolume = 0.5;
  private perSound: Partial<Record<SoundEvent, SoundConfig>> = {};

  setGlobalMute(mute: boolean) { this.globalMute = mute; }
  setGlobalVolume(volume: number) { this.globalVolume = Math.max(0, Math.min(1, volume)); }
  setSoundEnabled(event: SoundEvent, enabled: boolean) {
    if (!this.perSound[event]) { this.perSound[event] = { enabled: true, volume: 1.0 }; }
    this.perSound[event]!.enabled = enabled;
  }
  isGlobalMuted(): boolean { return this.globalMute; }
  getGlobalVolume(): number { return this.globalVolume; }
  isSoundEnabled(event: SoundEvent): boolean { return this.perSound[event]?.enabled ?? true; }

  play(event: SoundEvent) {
    if (this.globalMute) return;
    const config = this.perSound[event];
    if (config && !config.enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume(); }
    const profile = SOUND_PROFILES[event];
    if (!profile) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.freq, ctx.currentTime);
    const volume = this.globalVolume * (config?.volume ?? 1.0);
    gainNode.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
    if (profile.ramp) {
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + profile.duration * 0.1);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + profile.duration);
      if (event === 'welcome') {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.linearRampToValueAtTime(volume * 0.25, ctx.currentTime + 0.2);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.7);
      }
    } else {
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + profile.duration);
    }
    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + profile.duration + 0.05);
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('pufferchat_sound_settings');
      if (saved) {
        const data = JSON.parse(saved);
        this.globalMute = data.globalMute ?? false;
        this.globalVolume = data.globalVolume ?? 0.5;
        this.perSound = data.perSound ?? {};
      }
    } catch { /* ignore */ }
  }

  saveSettings() {
    try {
      localStorage.setItem('pufferchat_sound_settings', JSON.stringify({
        globalMute: this.globalMute,
        globalVolume: this.globalVolume,
        perSound: this.perSound,
      }));
    } catch { /* ignore */ }
  }
}

export const soundEngine = new SoundEngine();
soundEngine.loadSettings();
