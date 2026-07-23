"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{
    urls: [
      "stun:stun.cloudflare.com:3478",
      "stun:stun.l.google.com:19302",
    ],
  }],
};

export function useVoiceChat(serverId: string) {
  const [room, setRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState("");
  const peerIdRef = useRef("");
  const roomRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const audioRef = useRef(new Map<string, HTMLAudioElement>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const pollTimerRef = useRef<number | null>(null);
  const pollingRef = useRef(false);
  const lastSignalRef = useRef(0);
  const serverRef = useRef(serverId);

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

  const createConnection = useCallback(async (remotePeerId: string, makeOffer: boolean) => {
    const existing = connectionsRef.current.get(remotePeerId);
    if (existing) return existing;

    const connection = new RTCPeerConnection(ICE_SERVERS);
    connectionsRef.current.set(remotePeerId, connection);
    streamRef.current?.getTracks().forEach((track) => connection.addTrack(track, streamRef.current!));

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal(remotePeerId, "ice", event.candidate.toJSON());
      }
    };
    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      let audio = audioRef.current.get(remotePeerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioRef.current.set(remotePeerId, audio);
      }
      audio.srcObject = stream;
      void audio.play().catch(() => undefined);
    };
    connection.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(connection.connectionState)) {
        connection.close();
        connectionsRef.current.delete(remotePeerId);
        audioRef.current.get(remotePeerId)?.remove();
        audioRef.current.delete(remotePeerId);
      }
    };

    if (makeOffer) {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await sendSignal(remotePeerId, "offer", offer);
    }
    return connection;
  }, [sendSignal]);

  const handleSignal = useCallback(async (signal: VoiceSignal) => {
    const data = JSON.parse(signal.payload) as RTCSessionDescriptionInit | RTCIceCandidateInit;
    const connection = await createConnection(signal.senderPeerId, false);
    const flushCandidates = async () => {
      const candidates = pendingCandidatesRef.current.get(signal.senderPeerId) ?? [];
      pendingCandidatesRef.current.delete(signal.senderPeerId);
      for (const candidate of candidates) {
        await connection.addIceCandidate(candidate);
      }
    };
    if (signal.kind === "offer") {
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
      connectionsRef.current.forEach((connection, remotePeerId) => {
        if (!livePeerIds.has(remotePeerId)) {
          connection.close();
          connectionsRef.current.delete(remotePeerId);
          const audio = audioRef.current.get(remotePeerId);
          audio?.pause();
          audio?.remove();
          audioRef.current.delete(remotePeerId);
        }
      });
      for (const peer of data.peers) {
        if (!connectionsRef.current.has(peer.peerId) && peerId < peer.peerId) {
          await createConnection(peer.peerId, true);
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
  }, [createConnection, handleSignal, postVoice]);

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
    pendingCandidatesRef.current.clear();
    pollingRef.current = false;
    audioRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    audioRef.current.clear();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const peerId = crypto.randomUUID();
      streamRef.current = stream;
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
      roomRef.current = null;
      peerIdRef.current = "";
      setRoom(null);
      setStatus("error");
      setError("Не удалось получить доступ к микрофону");
    }
  }, [leave, poll, postVoice, serverId, status]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  useEffect(() => {
    if (serverRef.current !== serverId && roomRef.current) void leave();
    serverRef.current = serverId;
  }, [leave, serverId]);

  useEffect(() => () => {
    void leave();
  }, [leave]);

  return { room, status, muted, participantCount, participants, error, join, leave, toggleMute };
}
