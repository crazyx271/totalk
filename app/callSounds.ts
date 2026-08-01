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

function softNote(ctx: AudioContext, freq: number, start: number, duration: number, gain = 0.1) {
  const primary = ctx.createOscillator();
  const shimmer = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const envelope = ctx.createGain();
  primary.type = "sine";
  shimmer.type = "triangle";
  primary.frequency.setValueAtTime(freq, start);
  shimmer.frequency.setValueAtTime(freq * 2, start);
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.035);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  primary.connect(filter);
  shimmer.connect(filter);
  filter.connect(envelope).connect(ctx.destination);
  primary.start(start); shimmer.start(start);
  primary.stop(start + duration + 0.02); shimmer.stop(start + duration + 0.02);
}

export function startRingtone() {
  stopRingtone();
  try {
    const ctx = getContext();
    const playPattern = () => {
      const now = ctx.currentTime;
      softNote(ctx, 523.25, now, 0.32, 0.09);
      softNote(ctx, 659.25, now + 0.22, 0.34, 0.095);
      softNote(ctx, 783.99, now + 0.46, 0.42, 0.085);
    };
    playPattern();
    ringtoneTimer = window.setInterval(playPattern, 2400);
  } catch {
    // Autoplay/audio restrictions — ringing still shows visually.
  }
}

export function playNotificationTone() {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    softNote(ctx, 659.25, now, 0.18, 0.07);
    softNote(ctx, 987.77, now + 0.1, 0.28, 0.06);
  } catch {
    // Visual/native notification still works if audio is unavailable.
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
