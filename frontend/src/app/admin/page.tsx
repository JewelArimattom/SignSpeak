"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, getToken, clearToken } from "@/lib/authApi";
import {
  AdminMessage,
  AdminUser,
  adminDeleteMessage,
  adminListMessages,
  adminListUsers,
} from "@/lib/adminApi";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const STAT_ICONS: Record<string, string> = {
  "Total Users":    "👥",
  "Total Messages": "💬",
  "Admin Role":     "🛡",
  "System":         "⚡",
};

const MOCK_SPARK = [3, 5, 4, 7, 6, 9, 8, 12, 10, 14];
const SYSTEM_SPARK = [8, 8, 9, 8, 9, 8, 9, 9, 9, 9];

function StatCard({ label, value, trend }: { label: string; value: string | number; trend?: number[] }) {
  const spark = trend ?? MOCK_SPARK;
  const max = Math.max(...spark);
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0a0a0a] px-6 py-5 flex flex-col gap-3 group hover:border-white/15 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-black text-white tracking-tight">{value}</p>
          <p className="text-xs text-zinc-600 mt-1 uppercase tracking-wider">{label}</p>
        </div>
        <span className="text-xl opacity-40 group-hover:opacity-70 transition-opacity">
          {STAT_ICONS[label] ?? "📊"}
        </span>
      </div>
      <div className="stat-spark">
        {spark.map((v, i) => (
          <div
            key={i}
            className="stat-spark-bar"
            style={{ height: `${Math.round((v / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [adminName, setAdminName] = useState<string>("Admin");
  const [isStaticAdmin, setIsStaticAdmin] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [communityFilter, setCommunityFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "messages">("users");

  const communityId = useMemo(() => {
    const n = Number(communityFilter.trim());
    if (!communityFilter.trim() || !Number.isFinite(n) || n <= 0) return undefined;
    return n;
  }, [communityFilter]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await adminListUsers(userSearch, 300);
      setUsers(data);
    } catch {
      // static admin may not have API access
    } finally {
      setLoadingUsers(false);
    }
  }, [userSearch]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const data = await adminListMessages(300, communityId);
      setMessages(data);
    } catch {
      // static admin may not have API access
    } finally {
      setLoadingMessages(false);
    }
  }, [communityId]);

  useEffect(() => {
    const staticAdmin = localStorage.getItem("admin-session") === "true";
    if (staticAdmin) {
      setIsStaticAdmin(true);
      setAdminName("Admin");
      loadUsers();
      loadMessages();
      return;
    }

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const meData = await getMe(token);
        if (!mounted) return;
        setAdminName(meData.full_name);
        await Promise.all([loadUsers(), loadMessages()]);
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load admin dashboard";
        setError(msg);
      }
    })();
    return () => { mounted = false; };
  }, [loadMessages, loadUsers, router]);

  const handleLogout = () => {
    localStorage.removeItem("admin-session");
    clearToken();
    router.push("/login");
  };

  const refreshAll = async () => {
    setError(null);
    try {
      await Promise.all([loadUsers(), loadMessages()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refresh failed";
      setError(msg);
    }
  };

  const onDeleteMessage = async (id: number) => {
    setError(null);
    setDeletingMessageId(id);
    try {
      await adminDeleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setError(msg);
    } finally {
      setDeletingMessageId(null);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white font-bold tracking-tight text-lg">
            SignSpeak
          </Link>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-slow" />
            <span className="text-sm font-semibold text-zinc-300">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-zinc-500 border border-white/8 rounded-full px-3 py-1.5">
            {isStaticAdmin ? "admin@signspeak.com" : adminName}
          </span>
          <button
            onClick={refreshAll}
            className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/8 transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={handleLogout}
            className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/8 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage users and moderate community messages.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Users" value={loadingUsers ? "…" : users.length} />
          <StatCard label="Total Messages" value={loadingMessages ? "…" : messages.length} />
          <StatCard label="Admin Role" value="Static" trend={[1,1,1,1,1,1,1,1,1,1]} />
          <StatCard label="System" value="Active" trend={SYSTEM_SPARK} />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border border-white/8 rounded-xl p-1 w-fit">
          {(["users", "messages"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? "bg-[#60a5fa] text-black"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {tab}
              <span className="ml-2 text-xs opacity-60">
                {tab === "users" ? users.length : messages.length}
              </span>
            </button>
          ))}
        </div>

        {/* Users tab */}
        {activeTab === "users" && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name or email…"
                className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors w-72"
              />
              <button
                onClick={loadUsers}
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-zinc-200 transition-colors"
              >
                Search
              </button>
            </div>

            {loadingUsers ? (
              <p className="text-zinc-600 text-sm">Loading users…</p>
            ) : users.length === 0 ? (
              <p className="text-zinc-600 text-sm">No users found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-white/8 bg-white/3 p-4 hover:border-white/15 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-white leading-tight">{u.full_name}</p>
                      {u.is_admin && (
                        <span className="text-[10px] uppercase tracking-wide rounded-md px-1.5 py-0.5 bg-white/10 text-white border border-white/20 flex-shrink-0">
                          admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                    <p className="text-[11px] text-zinc-700 mt-2">Joined {formatDate(u.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Messages tab */}
        {activeTab === "messages" && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <input
                value={communityFilter}
                onChange={(e) => setCommunityFilter(e.target.value)}
                placeholder="Filter by community ID (optional)…"
                className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors w-72"
              />
              <button
                onClick={loadMessages}
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-zinc-200 transition-colors"
              >
                Apply
              </button>
            </div>

            {loadingMessages ? (
              <p className="text-zinc-600 text-sm">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="text-zinc-600 text-sm">No messages found for this filter.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <article
                    key={m.id}
                    className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 hover:border-white/14 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs text-zinc-500">#{m.id} · Community {m.community_id}</span>
                          <span className="text-xs text-zinc-400 font-medium">{m.sender.full_name}</span>
                          <span className="text-xs text-zinc-600">{formatDate(m.created_at)}</span>
                        </div>
                        <p className="text-sm text-white whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                      <button
                        onClick={() => onDeleteMessage(m.id)}
                        disabled={deletingMessageId === m.id}
                        className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          deletingMessageId === m.id
                            ? "bg-white/5 text-zinc-600 cursor-not-allowed"
                            : "bg-white/6 border border-white/10 text-zinc-300 hover:bg-white/12"
                        }`}
                      >
                        {deletingMessageId === m.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
