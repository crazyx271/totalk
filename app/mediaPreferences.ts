"use client";

const KEYS = {
  audioInput: "totalk:audioInputId",
  videoInput: "totalk:videoInputId",
  audioOutput: "totalk:audioOutputId",
  noiseSuppression: "totalk:noiseSuppression",
};

function read(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing or storage disabled — preference just won't persist.
  }
}

export function getAudioInputId() {
  return read(KEYS.audioInput);
}
export function setAudioInputId(deviceId: string) {
  write(KEYS.audioInput, deviceId);
}

export function getVideoInputId() {
  return read(KEYS.videoInput);
}
export function setVideoInputId(deviceId: string) {
  write(KEYS.videoInput, deviceId);
}

export function getAudioOutputId() {
  return read(KEYS.audioOutput);
}
export function setAudioOutputId(deviceId: string) {
  write(KEYS.audioOutput, deviceId);
}

export function getNoiseSuppression() {
  return read(KEYS.noiseSuppression) !== "off";
}
export function setNoiseSuppression(on: boolean) {
  write(KEYS.noiseSuppression, on ? "on" : "off");
}

type SinkableElement = HTMLMediaElement & { setSinkId?: (sinkId: string) => Promise<void> };

export function supportsAudioOutputSelection() {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

export function applyAudioOutput(element: HTMLMediaElement) {
  const sinkId = getAudioOutputId();
  const sinkable = element as SinkableElement;
  if (sinkId && sinkable.setSinkId) {
    sinkable.setSinkId(sinkId).catch(() => {
      // Device was unplugged or is no longer valid — keep the current output.
    });
  }
}
