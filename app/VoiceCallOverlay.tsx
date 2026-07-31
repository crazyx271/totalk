"use client";

import { useEffect, useRef, useState } from "react";
import type { VoiceParticipant } from "./useVoiceChat";
import Avatar from "./Avatar";
import { MicIcon, MicOffIcon, MonitorIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from "./CallIcons";

type CallTileProps = {
  name: string;
  avatarPath?: string | null;
  sub?: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  sharingScreen?: boolean;
};

function CallTile({ name, avatarPath, sub, stream, isLocal = false, sharingScreen = false }: CallTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`call-tile ${hasVideo ? "has-video" : ""}`}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className={isLocal && !sharingScreen ? "mirrored" : ""} />
      <Avatar name={name} avatarPath={avatarPath} className="call-tile-avatar" />
      {sharingScreen && <span className="call-tile-badge" aria-label="Демонстрация экрана"><MonitorIcon /></span>}
      <div className="call-tile-label"><b>{name}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export type VoiceCallOverlayProps = {
  title: string;
  subtitle?: string;
  error?: string;
  selfName: string;
  selfAvatarPath?: string | null;
  participants: VoiceParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  cameraOn: boolean;
  screenSharing: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
};

export default function VoiceCallOverlay({
  title,
  subtitle,
  error,
  selfName,
  selfAvatarPath,
  participants,
  localStream,
  remoteStreams,
  cameraOn,
  screenSharing,
  muted,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
}: VoiceCallOverlayProps) {
  const hasAnyVideo = cameraOn || screenSharing || [...remoteStreams.values()].some((stream) => stream.getVideoTracks().length > 0);
  const connected = participants.length > 0;

  const [elapsed, setElapsed] = useState(0);
  const connectedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (connected && connectedAtRef.current === null) connectedAtRef.current = Date.now();
    if (!connected) connectedAtRef.current = null;
  }, [connected]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(connectedAtRef.current ? Math.floor((Date.now() - connectedAtRef.current) / 1000) : 0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`voice-overlay ${hasAnyVideo ? "voice-overlay-video" : ""}`}>
      <div className="voice-overlay-header">
        <Avatar name={selfName} avatarPath={selfAvatarPath} className={`voice-pulse ${connected ? "" : "ringing"}`} />
        <div>
          <b>{title}</b>
          <small>{connected ? formatDuration(elapsed) : subtitle}</small>
        </div>
      </div>
      {error && <div className="voice-overlay-error">{error}</div>}
      <div className="call-tile-grid">
        <CallTile name={selfName} avatarPath={selfAvatarPath} sub="Вы" stream={localStream} isLocal sharingScreen={screenSharing} />
        {participants.map((participant) => (
          <CallTile
            key={participant.peerId}
            name={participant.displayName}
            avatarPath={participant.avatarPath}
            sub={`@${participant.username}`}
            stream={remoteStreams.get(participant.peerId) ?? null}
          />
        ))}
      </div>
      <div className="voice-overlay-controls">
        <button type="button" className={`call-control-card ${muted ? "danger" : ""}`} onClick={onToggleMute} aria-pressed={muted}>
          {muted ? <MicOffIcon /> : <MicIcon />}
          <span>Микрофон</span>
        </button>
        <button type="button" className={`call-control-card ${cameraOn ? "active" : ""}`} onClick={() => void onToggleCamera()} aria-pressed={cameraOn}>
          {cameraOn ? <VideoIcon /> : <VideoOffIcon />}
          <span>Камера</span>
        </button>
        <button type="button" className={`call-control-card ${screenSharing ? "active" : ""}`} onClick={() => void onToggleScreenShare()} aria-pressed={screenSharing}>
          <MonitorIcon />
          <span>{screenSharing ? "Стоп показ" : "Экран"}</span>
        </button>
        <button type="button" className="call-control-card danger leave" onClick={onLeave}>
          <PhoneOffIcon />
          <span>Завершить</span>
        </button>
      </div>
    </div>
  );
}
