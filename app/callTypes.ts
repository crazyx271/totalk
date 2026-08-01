export type Friend = {
  id: number;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  bannerColor: string | null;
  createdAt: string;
  isOnline: boolean;
  isUltra: boolean;
  requestId?: number;
};

export type DirectCall = {
  id: number;
  callerId: number;
  calleeId: number;
  room: string;
  status: "ringing" | "accepted";
  incoming: boolean;
  person: Friend;
};
