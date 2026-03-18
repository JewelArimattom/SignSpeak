"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, getToken } from "@/lib/authApi";
import {
  ChatMember,
  ChatMessage,
  Community,
  createCommunity,
  getChatWsUrl,
  getCommunityHistory,
  getCommunityMembers,
  joinCommunityByName,
  listCommunities,
} from "@/lib/chatApi";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useHandGestureComposer } from "@/hooks/useHandGestureComposer";

type TypingMap = Record<number, string>;
const DEFAULT_COMMUNITY_NAME = "general";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
  ["SPACE", "⌫", "⏎"],
] as const;

function timeLabel(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function CommunityChatPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ id: number; full_name: string; email: string; is_admin?: boolean } | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [joinName, setJoinName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typingMap, setTypingMap] = useState<TypingMap>({});
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const wsUrl = useMemo(() => {
    if (!activeCommunity) return null;
    try {
      return getChatWsUrl(activeCommunity.id);
    } catch {
      return null;
    }
  }, [activeCommunity]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  const replaceMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  }, []);

  const removeMessage = useCallback((messageId: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const {
    connected: chatConnected,
    sendMessage,
    sendTyping,
    editMessage,
    deleteMessage,
  } = useChatSocket({
    wsUrl,
    onMessageCreated: appendMessage,
    onMessageUpdated: replaceMessage,
    onMessageDeleted: removeMessage,
    onPresenceSnapshot: (onlineMembers) => {
      const onlineIds = new Set(onlineMembers.map((m) => m.id));
      setMembers((prev) => prev.map((member) => ({ ...member, online: onlineIds.has(member.id) })));
    },
    onMemberOnline: (member) => {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, online: true } : m)));
    },
    onMemberOffline: (member) => {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, online: false } : m)));
    },
    onTyping: (evt) => {
      if (!me || evt.user.id === me.id || !evt.is_typing) {
        if (!evt.is_typing) {
          setTypingMap((prev) => {
            const next = { ...prev };
            delete next[evt.user.id];
            return next;
          });
        }
        return;
      }

      setTypingMap((prev) => ({ ...prev, [evt.user.id]: evt.user.full_name }));
      window.setTimeout(() => {
        setTypingMap((prev) => {
          const next = { ...prev };
          delete next[evt.user.id];
          return next;
        });
      }, 2200);
    },
  });

  const {
    videoRef,
    canvasRef,
    connected: gestureConnected,
    cameraActive,
    tracking,
    currentLetter,
    confidence,
    connect: connectGesture,
    startCamera,
    stopCamera,
    startTracking,
    stopTracking,
  } = useHandGestureComposer();

  const refreshCommunities = useCallback(async () => {
    let list = await listCommunities();

    // First-time users may have zero communities; create or join a shared default.
    if (list.length === 0) {
      try {
        await createCommunity({
          name: DEFAULT_COMMUNITY_NAME,
          description: "Default space for everyone.",
        });
      } catch {
        // If it already exists, try joining it.
        try {
          await joinCommunityByName(DEFAULT_COMMUNITY_NAME);
        } catch {
          // Ignore and continue; list below will drive UI state.
        }
      }
      list = await listCommunities();
    }

    setCommunities(list);

    if (list.length === 0) {
      setActiveCommunity(null);
      return;
    }

    if (!activeCommunity) {
      setActiveCommunity(list[0]);
      return;
    }

    const stillExists = list.some((community) => community.id === activeCommunity.id);
    if (!stillExists) {
      setActiveCommunity(list[0]);
    }
  }, [activeCommunity]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const user = await getMe(token);
        if (!mounted) return;
        setMe(user);
        await refreshCommunities();
      } catch {
        router.push("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, refreshCommunities]);

  useEffect(() => {
    if (!activeCommunity) return;
    (async () => {
      try {
        const [membersList, history] = await Promise.all([
          getCommunityMembers(activeCommunity.id),
          getCommunityHistory(activeCommunity.id, 120),
        ]);
        setMembers(membersList);
        setMessages(history);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load community";
        setError(msg);
      }
    })();
  }, [activeCommunity]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const match = composer.match(/(?:^|\s)@([A-Za-z0-9_.-]{0,40})$/);
    if (match) {
      setMentionOpen(true);
      setMentionQuery(match[1].toLowerCase());
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }
  }, [composer]);

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.trim();
    return members
      .filter((m) => {
        const nameKey = m.full_name.replace(/\s+/g, "").toLowerCase();
        const emailKey = m.email.split("@")[0].toLowerCase();
        if (!q) return true;
        return nameKey.includes(q) || emailKey.includes(q);
      })
      .slice(0, 7);
  }, [members, mentionOpen, mentionQuery]);

  const doSend = useCallback(() => {
    if (!composer.trim()) return;
    if (!activeCommunity) {
      setError("Create or join a community first.");
      return;
    }
    if (!chatConnected) {
      setError("Connecting to chat. Try again in a moment.");
      return;
    }
    sendMessage(composer.trim());
    setComposer("");
    sendTyping(false);
  }, [activeCommunity, chatConnected, composer, sendMessage, sendTyping]);

  const enableGesture = async () => {
    setError(null);
    try {
      setGestureEnabled(true);
      connectGesture(
        (letter) => {
          setComposer((prev) => prev + letter);
        },
        () => {
          doSend();
        },
        () => {
          setComposer((prev) => prev + " ");
        },
        () => {
          setComposer((prev) => prev.slice(0, -1));
        }
      );

      // Ensure the gesture camera panel is mounted so refs are available.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await startCamera();
      startTracking();
    } catch (err) {
      stopTracking();
      stopCamera();
      setGestureEnabled(false);
      const msg = err instanceof Error ? err.message : "Could not enable gesture mode";
      setError(msg);
    }
  };

  const disableGesture = () => {
    stopTracking();
    stopCamera();
    setGestureEnabled(false);
  };

  const createCommunityAction = async () => {
    setError(null);
    if (communityName.trim().length < 3) {
      setError("Community name must be at least 3 characters.");
      return;
    }

    try {
      const community = await createCommunity({
        name: communityName.trim(),
        description: communityDescription.trim(),
      });
      setCommunityName("");
      setCommunityDescription("");
      await refreshCommunities();
      setActiveCommunity(community);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create community");
    }
  };

  const joinCommunityAction = async () => {
    setError(null);
    if (!joinName.trim()) return;
    try {
      await joinCommunityByName(joinName.trim());
      setJoinName("");
      await refreshCommunities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join community");
    }
  };

  const onComposerKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      doSend();
      return;
    }

    if (event.key === "@") {
      setMentionOpen(true);
    }
  };

  const applyMention = (member: ChatMember) => {
    const emailAlias = member.email.split("@")[0];
    setComposer((prev) => prev.replace(/@([A-Za-z0-9_.-]{0,40})$/, `@${emailAlias} `));
    setMentionOpen(false);
  };

  const onlineMembers = members.filter((m) => m.online);
  const typingUsers = Object.values(typingMap);

  const highlightMentions = (content: string) => {
    const parts = content.split(/(@[A-Za-z0-9_.-]+)/g);
    return parts.map((part, idx) =>
      part.startsWith("@") ? (
        <span key={`${part}-${idx}`} className="text-blue-300 font-semibold">
          {part}
        </span>
      ) : (
        <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
      )
    );
  };

  return (
    <main className="min-h-screen px-4 md:px-8 py-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500 bg-clip-text text-transparent">
                Community Chat
              </span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Real-time groups with PostgreSQL history, mentions, online members, and gesture input.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {me?.is_admin && (
            <Link
              href="/admin"
              className="rounded-xl border border-amber-300/30 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/25"
            >
              Admin Dashboard
            </Link>
          )}
          <div className="glass rounded-xl px-4 py-2 text-sm text-gray-300">
            {me ? `Signed in as ${me.full_name}` : "Loading account..."}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <aside className="xl:col-span-3 space-y-4">
          <section className="glass rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Your Communities</h2>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {communities.map((community) => (
                <button
                  key={community.id}
                  onClick={() => setActiveCommunity(community)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                    activeCommunity?.id === community.id
                      ? "border-cyan-400/40 bg-cyan-400/10"
                      : "border-gray-700/50 bg-gray-900/30 hover:bg-gray-800/60"
                  }`}
                >
                  <p className="text-sm font-medium text-white">{community.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {community.member_count} members • {community.online_count} online
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Create Community</h3>
            <input
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              placeholder="community name"
              className="w-full rounded-xl bg-gray-900/60 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/60"
            />
            <textarea
              value={communityDescription}
              onChange={(e) => setCommunityDescription(e.target.value)}
              placeholder="description"
              className="w-full rounded-xl bg-gray-900/60 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/60 resize-none"
              rows={2}
            />
            <button
              onClick={createCommunityAction}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 py-2 text-sm font-semibold text-white"
            >
              Create
            </button>
          </section>

          <section className="glass rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Join by Name</h3>
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="type exact community name"
              className="w-full rounded-xl bg-gray-900/60 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/60"
            />
            <button
              onClick={joinCommunityAction}
              className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 py-2 text-sm font-semibold text-cyan-300"
            >
              Join
            </button>
          </section>
        </aside>

        <section className="xl:col-span-6 glass rounded-2xl border border-white/10 flex flex-col min-h-[72vh]">
          <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {activeCommunity ? activeCommunity.name : "Select a community"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {chatConnected ? "Realtime connected" : "Connecting..."}
              </p>
            </div>
            <div className="text-xs text-gray-400">
              {onlineMembers.length} online • {chatConnected ? "Connected" : "Disconnected"}
            </div>
          </div>

          <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                No messages yet. Start the conversation.
              </div>
            ) : (
              messages.map((msg) => {
                const mine = me?.id === msg.sender.id;
                return (
                  <article key={msg.id} className={`max-w-[86%] ${mine ? "ml-auto" : "mr-auto"}`}>
                    <div className={mine ? "chat-bubble-mine px-4 py-2.5" : "chat-bubble-other px-4 py-2.5"}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className={`text-xs font-semibold ${mine ? "text-[#93c5fd]" : "text-zinc-300"}`}>{msg.sender.full_name}</p>
                        <p className="text-[10px] text-zinc-600">{timeLabel(msg.created_at)}</p>
                      </div>

                      {editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full rounded-xl bg-gray-900/60 border border-gray-700 px-2 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/60 resize-none"
                            rows={2}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                editMessage(msg.id, editValue.trim());
                                setEditingMessageId(null);
                                setEditValue("");
                              }}
                              className="rounded-lg bg-cyan-500/30 px-2.5 py-1 text-xs text-cyan-100"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditValue("");
                              }}
                              className="rounded-lg bg-gray-700/60 px-2.5 py-1 text-xs text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">
                          {highlightMentions(msg.content)}
                        </p>
                      )}

                      {(mine || msg.edited_at) && editingMessageId !== msg.id && (
                        <div className="mt-2 flex items-center gap-2">
                          {mine && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditValue(msg.content);
                                }}
                                className="text-[10px] text-cyan-300 hover:text-cyan-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="text-[10px] text-red-300 hover:text-red-100"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {msg.edited_at && <span className="text-[10px] text-gray-500">edited</span>}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-white/10 px-4 py-3 space-y-2">
            <div className="flex items-center justify-end">
              <button
                onClick={() => setKeyboardOpen((prev) => !prev)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  keyboardOpen
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/40"
                    : "bg-gray-800 text-gray-300 border border-gray-700"
                }`}
              >
                {keyboardOpen ? "Hide Keyboard" : "⌨ Show Keyboard"}
              </button>
            </div>

            {keyboardOpen && (
              <div className="rounded-xl border border-indigo-400/20 bg-gray-900/80 p-3 space-y-2">
                {KEYBOARD_ROWS.map((row) => (
                  <div key={row.join("-")} className="flex flex-wrap gap-1.5 justify-center">
                    {row.map((key) => {
                      const isWide = key === "SPACE" || key === "⌫" || key === "⏎";
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (key === "SPACE") {
                              setComposer((prev) => prev + " ");
                            } else if (key === "⌫") {
                              setComposer((prev) => prev.slice(0, -1));
                            } else if (key === "⏎") {
                              doSend();
                            } else {
                              setComposer((prev) => prev + key);
                            }
                            sendTyping(true);
                          }}
                          className={`rounded-lg border text-xs font-semibold transition-all ${
                            isWide ? "px-4 py-2.5 min-w-[80px]" : "w-9 h-9"
                          } bg-gray-800/70 border-gray-600/50 text-gray-200 hover:bg-indigo-500/20 hover:border-indigo-400/40 hover:text-white active:bg-indigo-500/40`}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
                <span className="text-xs text-zinc-600">{typingUsers.join(", ")} typing…</span>
              </div>
            )}

            <div className="relative">
              <textarea
                value={composer}
                onChange={(e) => {
                  setComposer(e.target.value);
                  sendTyping(e.target.value.trim().length > 0);
                }}
                onKeyDown={onComposerKeyDown}
                placeholder="Type a message, @mention someone, Enter to send, Shift+Enter newline"
                className="w-full rounded-2xl bg-gray-900/70 border border-gray-700 px-3 py-3 pr-28 text-sm text-white focus:outline-none focus:border-cyan-400/60 resize-none"
                rows={3}
              />
              <button
                onClick={doSend}
                disabled={!chatConnected || !activeCommunity}
                className={`absolute right-2 bottom-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity ${
                  !chatConnected || !activeCommunity
                    ? "opacity-40 cursor-not-allowed bg-gray-700"
                    : "bg-gradient-to-r from-cyan-500 to-blue-500"
                }`}
              >
                Send
              </button>

              {mentionOpen && mentionCandidates.length > 0 && (
                <div className="absolute left-2 right-2 bottom-16 rounded-xl border border-gray-700 bg-gray-950/95 p-2 z-20">
                  {mentionCandidates.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => applyMention(member)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <p className="text-sm text-gray-100">{member.full_name}</p>
                      <p className="text-xs text-gray-400">@{member.email.split("@")[0]}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => (gestureEnabled ? disableGesture() : enableGesture())}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  gestureEnabled
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                    : "bg-gray-800 text-gray-300 border border-gray-700"
                }`}
              >
                {gestureEnabled ? "Disable Hand Gesture" : "Enable Hand Gesture"}
              </button>
              <span className="text-xs text-gray-500">
                Gesture controls: hold Z to send, Y for space, X for delete
              </span>
              {gestureEnabled && (
                <span className="text-xs text-cyan-300">
                  Live: {gestureConnected ? "Connected" : "Connecting"} • Camera {cameraActive ? "On" : "Off"} • Tracking {tracking ? "On" : "Off"} • Letter {currentLetter ?? "-"} ({Math.round(confidence * 100)}%)
                </span>
              )}
            </div>
          </div>
        </section>

        <aside className="xl:col-span-3 space-y-4">
          <section className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Online Members</h3>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {onlineMembers.length === 0 && <p className="text-xs text-gray-500">No one online yet.</p>}
              {onlineMembers.map((member) => (
                <div key={member.id} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
                  <p className="text-sm text-gray-100">{member.full_name}</p>
                  <p className="text-xs text-gray-400">@{member.email.split("@")[0]}</p>
                </div>
              ))}
            </div>
          </section>

          {gestureEnabled && (
            <section className="glass rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Gesture Camera</h3>
              <div className="relative rounded-xl overflow-hidden border border-gray-700/60 bg-gray-900">
                <video ref={videoRef} className="w-full camera-mirror" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Hold signs to type letters into the composer.
              </p>
            </section>
          )}

          <section className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Modern Features Included</h3>
            <ul className="text-xs text-gray-400 space-y-1.5">
              <li>• Group communities</li>
              <li>• PostgreSQL chat history</li>
              <li>• Real-time WebSocket delivery</li>
              <li>• @mentions and suggestions</li>
              <li>• Online presence and typing indicators</li>
              <li>• Edit/delete own messages</li>
              <li>• Keyboard and hand-gesture message input</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
