let audioContext: AudioContext | null = null;
let ringtoneTimer: number | null = null;

function getContext() {
  audioContext ??= new AudioContext();
  return audioContext;
}

function beep(ctx: AudioContext, freq: number, start: number, duration: number, gain = 0.15) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.02);
  gainNode.gain.linearRampToValueAtTime(0, start + duration);
  oscillator.connect(gainNode).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function startRingtone() {
  stopRingtone();
  try {
    const ctx = getContext();
    const playPattern = () => {
      const now = ctx.currentTime;
      beep(ctx, 740, now, 0.28);
      beep(ctx, 740, now + 0.35, 0.28);
    };
    playPattern();
    ringtoneTimer = window.setInterval(playPattern, 1800);
  } catch {
    // Autoplay/audio restrictions — ringing still shows visually.
  }
}

export function stopRingtone() {
  if (ringtoneTimer !== null) {
    window.clearInterval(ringtoneTimer);
    ringtoneTimer = null;
  }
}

export function playConnectTone() {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    beep(ctx, 523.25, now, 0.12, 0.12);
    beep(ctx, 659.25, now + 0.12, 0.16, 0.12);
  } catch {
    // Ignore — non-essential feedback.
  }
}

export function playEndTone() {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    beep(ctx, 440, now, 0.18, 0.12);
    beep(ctx, 330, now + 0.15, 0.22, 0.12);
  } catch {
    // Ignore — non-essential feedback.
  }
}
