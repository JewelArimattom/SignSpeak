import { getToken } from "@/lib/authApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Community = {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_at: string;
  member_count: number;
  online_count: number;
};

export type ChatMember = {
  id: number;
  full_name: string;
  email: string;
  online: boolean;
};

export type MessageUser = {
  id: number;
  full_name: string;
  email: string;
};

export type ChatMessage = {
  id: number;
  community_id: number;
  sender: MessageUser;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  mentions: MessageUser[];
};

async function withAuth(path: string, init: RequestInit = {}) {
  const token = getToken();
  if (!token) {
    throw new Error("Please login first.");
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data && typeof data.detail === "string" ? data.detail : "Request failed";
    throw new Error(detail);
  }
  return data;
}

export async function listCommunities(): Promise<Community[]> {
  const data = await withAuth("/chat/communities");
  return data.communities ?? [];
}

export async function createCommunity(payload: {
  name: string;
  description: string;
}): Promise<Community> {
  const data = await withAuth("/chat/communities", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.community;
}

export async function joinCommunityByName(community_name: string) {
  return withAuth("/chat/communities/join", {
    method: "POST",
    body: JSON.stringify({ community_name }),
  });
}

export async function getCommunityMembers(communityId: number): Promise<ChatMember[]> {
  const data = await withAuth(`/chat/communities/${communityId}/members`);
  return data.members ?? [];
}

export async function getCommunityHistory(
  communityId: number,
  limit = 80,
  beforeId?: number
): Promise<ChatMessage[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (beforeId) query.set("before_id", String(beforeId));
  const data = await withAuth(`/chat/communities/${communityId}/history?${query.toString()}`);
  return data.messages ?? [];
}

export async function postMessage(communityId: number, content: string): Promise<ChatMessage> {
  const data = await withAuth(`/chat/communities/${communityId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return data.message;
}

export function getChatWsUrl(communityId: number): string {
  const token = getToken();
  if (!token) {
    throw new Error("Please login first.");
  }
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/^http/, "ws");
  return `${base}/ws/chat/${communityId}?token=${encodeURIComponent(token)}`;
}
