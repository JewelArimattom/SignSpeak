import { getToken } from "@/lib/authApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  created_at: string;
  is_admin: boolean;
};

export type AdminMessage = {
  id: number;
  community_id: number;
  sender: {
    id: number;
    full_name: string;
    email: string;
  };
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
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

export async function adminListUsers(search = "", limit = 200): Promise<AdminUser[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (search.trim()) query.set("q", search.trim());
  const data = await withAuth(`/admin/users?${query.toString()}`);
  return data.users ?? [];
}

export async function adminListMessages(
  limit = 250,
  communityId?: number
): Promise<AdminMessage[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (communityId !== undefined && Number.isFinite(communityId)) {
    query.set("community_id", String(communityId));
  }
  const data = await withAuth(`/admin/messages?${query.toString()}`);
  return data.messages ?? [];
}

export async function adminDeleteMessage(messageId: number): Promise<void> {
  await withAuth(`/admin/messages/${messageId}`, { method: "DELETE" });
}
