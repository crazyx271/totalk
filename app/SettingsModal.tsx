"use client";

import { useEffect, useState } from "react";
import { XIcon } from "./Icons";
import {
  getAudioInputId,
  getAudioOutputId,
  getNoiseSuppression,
  getVideoInputId,
  setAudioInputId,
  setAudioOutputId,
  setNoiseSuppression,
  setVideoInputId,
  supportsAudioOutputSelection,
} from "./mediaPreferences";

type Device = { deviceId: string; label: string };

function pickDevices(devices: MediaDeviceInfo[], kind: MediaDeviceKind, fallback: string) {
  return devices
    .filter((device) => device.kind === kind)
    .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `${fallback} ${index + 1}` }));
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [mics, setMics] = useState<Device[]>([]);
  const [cameras, setCameras] = useState<Device[]>([]);
  const [speakers, setSpeakers] = useState<Device[]>([]);
  const [audioInput, setAudioInput] = useState(getAudioInputId());
  const [videoInput, setVideoInput] = useState(getVideoInputId());
  const [audioOutput, setAudioOutput] = useState(getAudioOutputId());
  const [noiseSuppression, setNoiseSuppressionOn] = useState(getNoiseSuppression());
  const outputSelectable = supportsAudioOutputSelection();

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then((devices) => {
        setMics(pickDevices(devices, "audioinput", "Микрофон"));
        setCameras(pickDevices(devices, "videoinput", "Камера"));
        setSpeakers(pickDevices(devices, "audiooutput", "Динамики"));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <section className="modal-card settings-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть"><XIcon /></button>
        <h1>Настройки устройств</h1>
        <p>Выбор устройства и шумоподавление применятся к следующему звонку.</p>

        <div className="settings-group">
          <label>Микрофон
            <select value={audioInput} onChange={(event) => { setAudioInput(event.target.value); setAudioInputId(event.target.value); }}>
              <option value="">Системный по умолчанию</option>
              {mics.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
            </select>
          </label>
          <label>Камера
            <select value={videoInput} onChange={(event) => { setVideoInput(event.target.value); setVideoInputId(event.target.value); }}>
              <option value="">Системная по умолчанию</option>
              {cameras.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
            </select>
          </label>
          {outputSelectable && (
            <label>Динамики
              <select value={audioOutput} onChange={(event) => { setAudioOutput(event.target.value); setAudioOutputId(event.target.value); }}>
                <option value="">Системные по умолчанию</option>
                {speakers.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
              </select>
            </label>
          )}
        </div>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={noiseSuppression}
            onChange={(event) => { setNoiseSuppressionOn(event.target.checked); setNoiseSuppression(event.target.checked); }}
          />
          Шумоподавление микрофона
        </label>
      </section>
    </div>
  );
}
