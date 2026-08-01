"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioInputId, getNoiseSuppression, getVideoInputId } from "./mediaPreferences";

type VoiceStatus = "idle" | "joining" | "connected" | "error";
type VoiceSignal = {
  id: number;
  senderPeerId: string;
  kind: "offer" | "answer" | "ice";
  payload: string;
};
export type VoiceParticipant = {
  peerId: string;
  userId: number;
  displayName: string;
  username: string;
  avatarPath: string | null;
};

type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [{
    urls: [
      "stun:stun.cloudflare.com:3478",
      "stun:stun.l.google.com:19302",
    ],
  }],
};

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 24 },
};

export function useVoiceChat(serverId: string) {
  const [room, setRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [error, setError] = useState("");
  const peerIdRef = useRef("");
  const roomRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const connectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const makingOfferRef = useRef(new Map<string, boolean>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const pollTimerRef = useRef<number | null>(null);
  const pollingRef = useRef(false);
  const lastSignalRef = useRef(0);
  const serverRef = useRef(serverId);
  const iceConfigRef = useRef<RTCConfiguration>(DEFAULT_ICE_SERVERS);

  const syncRemoteStreams = useCallback(() => {
    setRemoteStreams(new Map(remoteStreamsRef.current));
  }, []);

  const loadIceConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/voice/ice", { cache: "no-store" });
      if (!response.ok) throw new Error("ice config unavailable");
      const data = await response.json() as { iceServers?: IceServerConfig[] };
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        iceConfigRef.current = { iceServers: data.iceServers };
        return;
      }
    } catch {
      // Fall back to STUN-only config when TURN is not configured yet.
    }
    iceConfigRef.current = DEFAULT_ICE_SERVERS;
  }, []);

  const postVoice = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: payload.action === "leave",
    });
    if (!response.ok) throw new Error("voice request failed");
    return response;
  }, []);

  const sendSignal = useCallback(async (
    targetPeerId: string,
    kind: VoiceSignal["kind"],
    data: unknown,
  ) => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !peerIdRef.current) return;
    await postVoice({
      action: "signal",
      peerId: peerIdRef.current,
      targetPeerId,
      serverId: serverRef.current,
      channel: currentRoom,
      kind,
      data,
    });
  }, [postVoice]);

  const dropConnection = useCallback((remotePeerId: string) => {
    const connection = connectionsRef.current.get(remotePeerId);
    connection?.close();
    connectionsRef.current.delete(remotePeerId);
    remoteStreamsRef.current.delete(remotePeerId);
    makingOfferRef.current.delete(remotePeerId);
    pendingCandidatesRef.current.delete(remotePeerId);
    syncRemoteStreams();
  }, [syncRemoteStreams]);

  const createConnection = useCallback(async (remotePeerId: string) => {
    const existing = connectionsRef.current.get(remotePeerId);
    if (existing) return existing;

    const connection = new RTCPeerConnection(iceConfigRef.current);
    connectionsRef.current.set(remotePeerId, connection);
    streamRef.current?.getTracks().forEach((track) => connection.addTrack(track, streamRef.current!));

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal(remotePeerId, "ice", event.candidate.toJSON());
      }
    };
    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      if (!remoteStreamsRef.current.has(remotePeerId)) {
        stream.onremovetrack = syncRemoteStreams;
      }
      remoteStreamsRef.current.set(remotePeerId, stream);
      event.track.onended = syncRemoteStreams;
      syncRemoteStreams();
    };
    // Fires for the initial addTrack above and again whenever a track is
    // later added/removed (e.g. toggling the camera mid-call). Both peers
    // may negotiate independently; handleSignal resolves glare (see
    // "offer" handling below) using peerId ordering as the polite/impolite tiebreak.
    connection.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(remotePeerId, true);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        await sendSignal(remotePeerId, "offer", connection.localDescription);
      } catch {
        // Next track change or poll cycle will retry negotiation.
      } finally {
        makingOfferRef.current.set(remotePeerId, false);
      }
    };
    connection.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(connection.connectionState)) {
        dropConnection(remotePeerId);
      }
    };

    return connection;
  }, [dropConnection, sendSignal, syncRemoteStreams]);

  const handleSignal = useCallback(async (signal: VoiceSignal) => {
    const data = JSON.parse(signal.payload) as RTCSessionDescriptionInit | RTCIceCandidateInit;
    const connection = await createConnection(signal.senderPeerId);
    const flushCandidates = async () => {
      const candidates = pendingCandidatesRef.current.get(signal.senderPeerId) ?? [];
      pendingCandidatesRef.current.delete(signal.senderPeerId);
      for (const candidate of candidates) {
        await connection.addIceCandidate(candidate);
      }
    };
    if (signal.kind === "offer") {
      const polite = peerIdRef.current > signal.senderPeerId;
      const making = makingOfferRef.current.get(signal.senderPeerId) ?? false;
      const collision = making || connection.signalingState !== "stable";
      if (collision) {
        if (!polite) return;
        await connection.setLocalDescription({ type: "rollback" });
      }
      await connection.setRemoteDescription(data as RTCSessionDescriptionInit);
      await flushCandidates();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await sendSignal(signal.senderPeerId, "answer", answer);
    } else if (signal.kind === "answer" && connection.signalingState === "have-local-offer") {
      await connection.setRemoteDescription(data as RTCSessionDescriptionInit);
      await flushCandidates();
    } else if (signal.kind === "ice") {
      const candidate = data as RTCIceCandidateInit;
      if (connection.remoteDescription) {
        await connection.addIceCandidate(candidate);
      } else {
        const queued = pendingCandidatesRef.current.get(signal.senderPeerId) ?? [];
        queued.push(candidate);
        pendingCandidatesRef.current.set(signal.senderPeerId, queued);
      }
    }
  }, [createConnection, sendSignal]);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    const currentRoom = roomRef.current;
    const peerId = peerIdRef.current;
    if (!currentRoom || !peerId) return;
    pollingRef.current = true;
    try {
      await postVoice({
        action: "heartbeat",
        peerId,
        serverId: serverRef.current,
        channel: currentRoom,
      });
      const query = new URLSearchParams({
        peer: peerId,
        server: serverRef.current,
        channel: currentRoom,
        after: String(lastSignalRef.current),
      });
      const response = await fetch(`/api/voice?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("voice poll failed");
      const data = await response.json() as {
        peers: VoiceParticipant[];
        signals: VoiceSignal[];
      };
      setParticipants(data.peers);
      setParticipantCount(data.peers.length + 1);
      const livePeerIds = new Set(data.peers.map((peer) => peer.peerId));
      [...connectionsRef.current.keys()].forEach((remotePeerId) => {
        if (!livePeerIds.has(remotePeerId)) dropConnection(remotePeerId);
      });
      for (const peer of data.peers) {
        if (!connectionsRef.current.has(peer.peerId) && peerId < peer.peerId) {
          await createConnection(peer.peerId);
        }
      }
      for (const signal of data.signals) {
        lastSignalRef.current = Math.max(lastSignalRef.current, signal.id);
        await handleSignal(signal);
      }
    } catch {
      setError("Связь с голосовой комнатой прервана");
      setStatus("error");
    } finally {
      pollingRef.current = false;
    }
  }, [createConnection, dropConnection, handleSignal, postVoice]);

  const leave = useCallback(async () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    const peerId = peerIdRef.current;
    if (peerId) {
      void postVoice({ action: "leave", peerId }).catch(() => undefined);
    }
    connectionsRef.current.forEach((connection) => connection.close());
    connectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    makingOfferRef.current.clear();
    pendingCandidatesRef.current.clear();
    pollingRef.current = false;
    setRemoteStreams(new Map());
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    localVideoTrackRef.current = null;
    setLocalStream(null);
    setCameraOn(false);
    setScreenSharing(false);
    peerIdRef.current = "";
    roomRef.current = null;
    lastSignalRef.current = 0;
    setRoom(null);
    setStatus("idle");
    setParticipantCount(0);
    setParticipants([]);
    setMuted(false);
  }, [postVoice]);

  const join = useCallback(async (channel: string) => {
    if (roomRef.current === channel && status === "connected") return;
    await leave();
    setStatus("joining");
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Микрофон недоступен: сайт открыт не по HTTPS. Голос и видео работают только на защищённом соединении.");
      return;
    }
    try {
      await loadIceConfig();
      const preferredInput = getAudioInputId();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: getNoiseSuppression(),
          autoGainControl: true,
          ...(preferredInput ? { deviceId: { ideal: preferredInput } } : {}),
        },
        video: false,
      });
      const peerId = crypto.randomUUID();
      streamRef.current = stream;
      setLocalStream(stream);
      peerIdRef.current = peerId;
      roomRef.current = channel;
      serverRef.current = serverId;
      await postVoice({ action: "join", peerId, serverId, channel });
      setRoom(channel);
      setStatus("connected");
      setParticipantCount(1);
      setParticipants([]);
      await poll();
      pollTimerRef.current = window.setInterval(() => void poll(), 1200);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
      roomRef.current = null;
      peerIdRef.current = "";
      setRoom(null);
      setStatus("error");
      setError("Не удалось получить доступ к микрофону");
    }
  }, [leave, loadIceConfig, poll, postVoice, serverId, status]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  // Camera and screen share both occupy the single outgoing video slot —
  // starting one stops the other, mirroring how most call apps only send
  // one video feed at a time over a mesh connection.
  const stopVideoTrack = useCallback(() => {
    const track = localVideoTrackRef.current;
    if (track) {
      connectionsRef.current.forEach((connection) => {
        const sender = connection.getSenders().find((item) => item.track === track);
        if (sender) connection.removeTrack(sender);
      });
      streamRef.current?.removeTrack(track);
      track.stop();
    }
    localVideoTrackRef.current = null;
    setCameraOn(false);
    setScreenSharing(false);
  }, []);

  const startVideoTrack = useCallback(async (source: "camera" | "screen") => {
    if (!streamRef.current) return;
    stopVideoTrack();
    try {
      const preferredCamera = getVideoInputId();
      const mediaStream = source === "camera"
        ? await navigator.mediaDevices.getUserMedia({
          video: { ...CAMERA_CONSTRAINTS, ...(preferredCamera ? { deviceId: { ideal: preferredCamera } } : {}) },
        })
        : await navigator.mediaDevices.getDisplayMedia({ video: true });
      const [track] = mediaStream.getVideoTracks();
      if (!track || !streamRef.current) return;
      track.onended = stopVideoTrack;
      localVideoTrackRef.current = track;
      streamRef.current.addTrack(track);
      connectionsRef.current.forEach((connection) => connection.addTrack(track, streamRef.current!));
      if (source === "camera") setCameraOn(true);
      else setScreenSharing(true);
    } catch {
      setError(source === "camera" ? "Не удалось получить доступ к камере" : "Не удалось начать демонстрацию экрана");
    }
  }, [stopVideoTrack]);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) stopVideoTrack();
    else await startVideoTrack("camera");
  }, [cameraOn, startVideoTrack, stopVideoTrack]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) stopVideoTrack();
    else await startVideoTrack("screen");
  }, [screenSharing, startVideoTrack, stopVideoTrack]);

  useEffect(() => {
    if (serverRef.current !== serverId && roomRef.current) void leave();
    serverRef.current = serverId;
  }, [leave, serverId]);

  useEffect(() => () => {
    void leave();
  }, [leave]);

  // Browsers throttle setInterval heavily once a tab has been hidden for a
  // while, which can delay the heartbeat past the server's peer TTL. Poll
  // immediately when the tab regains visibility so presence recovers fast.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && roomRef.current) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [poll]);

  return {
    room,
    status,
    muted,
    cameraOn,
    screenSharing,
    participantCount,
    participants,
    localStream,
    remoteStreams,
    error,
    join,
    leave,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
}
