"use client";

import { useEffect, useRef } from "react";
import type { VoiceParticipant } from "./useVoiceChat";

type CallTileProps = {
  name: string;
  sub?: string;
  stream: MediaStream | null;
  isLocal?: boolean;
};

function CallTile({ name, sub, stream, isLocal = false }: CallTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`call-tile ${hasVideo ? "has-video" : ""}`}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className={isLocal ? "mirrored" : ""} />
      <span className="call-tile-avatar">{name.charAt(0).toUpperCase() || "?"}</span>
      <div className="call-tile-label"><b>{name}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

export type VoiceCallOverlayProps = {
  title: string;
  subtitle?: string;
  selfName: string;
  participants: VoiceParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  cameraOn: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
};

export default function VoiceCallOverlay({
  title,
  subtitle,
  selfName,
  participants,
  localStream,
  remoteStreams,
  cameraOn,
  muted,
  onToggleMute,
  onToggleCamera,
  onLeave,
}: VoiceCallOverlayProps) {
  const hasAnyVideo = cameraOn || [...remoteStreams.values()].some((stream) => stream.getVideoTracks().length > 0);

  return (
    <div className={`voice-overlay ${hasAnyVideo ? "voice-overlay-video" : ""}`}>
      <div className="voice-overlay-header">
        <span className="voice-pulse">{selfName.charAt(0).toUpperCase()}</span>
        <div><b>{title}</b>{subtitle && <small>{subtitle}</small>}</div>
      </div>
      <div className="call-tile-grid">
        <CallTile name={selfName} sub="Вы" stream={localStream} isLocal />
        {participants.map((participant) => (
          <CallTile
            key={participant.peerId}
            name={participant.displayName}
            sub={`@${participant.username}`}
            stream={remoteStreams.get(participant.peerId) ?? null}
          />
        ))}
      </div>
      <div className="voice-overlay-controls">
        <button onClick={onToggleMute} aria-pressed={muted} aria-label={muted ? "Включить микрофон" : "Выключить микрофон"}>{muted ? "⊘" : "●"}</button>
        <button onClick={() => void onToggleCamera()} aria-pressed={cameraOn} aria-label={cameraOn ? "Выключить камеру" : "Включить камеру"}>{cameraOn ? "▣" : "▢"}</button>
        <button className="decline-call" onClick={onLeave} aria-label="Завершить звонок">☎</button>
      </div>
    </div>
  );
}
