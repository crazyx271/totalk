"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";
import type { VoiceParticipant } from "./useVoiceChat";
import Avatar from "./Avatar";
import { ExpandIcon, MicIcon, MicOffIcon, MinimizeIcon, MonitorIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from "./CallIcons";
import { applyAudioOutput } from "./mediaPreferences";

type Tile = {
  key: string;
  name: string;
  avatarPath?: string | null;
  sub?: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  sharingScreen?: boolean;
};

function CallTile({ tile, focused, focusable, onToggleFocus }: {
  tile: Tile;
  focused: boolean;
  focusable: boolean;
  onToggleFocus: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasVideo = Boolean(tile.stream?.getVideoTracks().length);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = tile.stream;
    if (!tile.isLocal) applyAudioOutput(videoRef.current);
  }, [tile.stream, tile.isLocal]);

  useEffect(() => {
    if (!hasVideo && document.fullscreenElement === containerRef.current) void document.exitFullscreen();
  }, [hasVideo]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen(event: MouseEvent) {
    event.stopPropagation();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }

  return (
    <div
      ref={containerRef}
      className={`call-tile ${hasVideo ? "has-video" : ""} ${focused ? "focused" : ""}`}
      onClick={focusable ? onToggleFocus : undefined}
      role={focusable ? "button" : undefined}
    >
      <video ref={videoRef} autoPlay playsInline muted={tile.isLocal} className={tile.isLocal && !tile.sharingScreen ? "mirrored" : ""} />
      <Avatar name={tile.name} avatarPath={tile.avatarPath} className="call-tile-avatar" />
      {tile.sharingScreen && <span className="call-tile-badge" aria-label="Демонстрация экрана"><MonitorIcon /></span>}
      {hasVideo && (
        <button type="button" className="call-tile-expand" onClick={toggleFullscreen} aria-label={isFullscreen ? "Свернуть" : "На весь экран"}>
          {isFullscreen ? <MinimizeIcon /> : <ExpandIcon />}
        </button>
      )}
      <div className="call-tile-label"><b>{tile.name}</b>{tile.sub && <small>{tile.sub}</small>}</div>
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
  const tiles: Tile[] = [
    { key: "self", name: selfName, avatarPath: selfAvatarPath, sub: "Вы", stream: localStream, isLocal: true, sharingScreen: screenSharing },
    ...participants.map((participant) => ({
      key: participant.peerId,
      name: participant.displayName,
      avatarPath: participant.avatarPath,
      sub: `@${participant.username}`,
      stream: remoteStreams.get(participant.peerId) ?? null,
    })),
  ];
  const hasAnyVideo = tiles.some((tile) => Boolean(tile.stream?.getVideoTracks().length));
  const connected = participants.length > 0;

  // `undefined` means "no manual choice yet — follow the local screen share
  // automatically"; `null` means the user explicitly chose the grid view.
  // Deriving focus this way (instead of syncing it in an effect) keeps it a
  // pure function of props+state, and a stale key just resolves to null below.
  const [manualFocus, setManualFocus] = useState<string | null | undefined>(undefined);
  const focusedKey = manualFocus !== undefined ? manualFocus : (screenSharing ? "self" : null);
  const focusedTile = tiles.find((tile) => tile.key === focusedKey) ?? null;
  const otherTiles = tiles.filter((tile) => tile.key !== focusedKey);

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
    <>
      {hasAnyVideo && <div className="voice-overlay-backdrop" />}
      <div className={`voice-overlay ${hasAnyVideo ? "voice-overlay-video" : ""}`}>
      <div className="voice-overlay-header">
        <Avatar name={selfName} avatarPath={selfAvatarPath} className={`voice-pulse ${connected ? "" : "ringing"}`} />
        <div>
          <b>{title}</b>
          <small>{connected ? formatDuration(elapsed) : subtitle}</small>
        </div>
      </div>
      {error && <div className="voice-overlay-error">{error}</div>}
      {focusedTile ? (
        <div className="call-tile-grid has-focus">
          <CallTile tile={focusedTile} focused focusable onToggleFocus={() => setManualFocus(null)} />
          {otherTiles.length > 0 && (
            <div className="call-tile-thumbs">
              {otherTiles.map((tile) => (
                <CallTile key={tile.key} tile={tile} focused={false} focusable={Boolean(tile.stream?.getVideoTracks().length)} onToggleFocus={() => setManualFocus(tile.key)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="call-tile-grid">
          {tiles.map((tile) => (
            <CallTile key={tile.key} tile={tile} focused={false} focusable={Boolean(tile.stream?.getVideoTracks().length)} onToggleFocus={() => setManualFocus(tile.key)} />
          ))}
        </div>
      )}
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
    </>
  );
}
