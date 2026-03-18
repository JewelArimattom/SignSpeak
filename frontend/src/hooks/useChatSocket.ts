"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, MessageUser } from "@/lib/chatApi";

type TypingEvent = {
  community_id: number;
  user: MessageUser;
  is_typing: boolean;
};

type UseChatSocketOptions = {
  wsUrl: string | null;
  onMessageCreated?: (message: ChatMessage) => void;
  onMessageUpdated?: (message: ChatMessage) => void;
  onMessageDeleted?: (messageId: number) => void;
  onPresenceSnapshot?: (members: MessageUser[]) => void;
  onMemberOnline?: (member: MessageUser) => void;
  onMemberOffline?: (member: MessageUser) => void;
  onTyping?: (event: TypingEvent) => void;
};

export function useChatSocket({
  wsUrl,
  onMessageCreated,
  onMessageUpdated,
  onMessageDeleted,
  onPresenceSnapshot,
  onMemberOnline,
  onMemberOffline,
  onTyping,
}: UseChatSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const createdRef = useRef(onMessageCreated);
  const updatedRef = useRef(onMessageUpdated);
  const deletedRef = useRef(onMessageDeleted);
  const snapshotRef = useRef(onPresenceSnapshot);
  const onlineRef = useRef(onMemberOnline);
  const offlineRef = useRef(onMemberOffline);
  const typingRef = useRef(onTyping);

  useEffect(() => {
    createdRef.current = onMessageCreated;
    updatedRef.current = onMessageUpdated;
    deletedRef.current = onMessageDeleted;
    snapshotRef.current = onPresenceSnapshot;
    onlineRef.current = onMemberOnline;
    offlineRef.current = onMemberOffline;
    typingRef.current = onTyping;
  }, [
    onMessageCreated,
    onMessageUpdated,
    onMessageDeleted,
    onPresenceSnapshot,
    onMemberOnline,
    onMemberOffline,
    onTyping,
  ]);

  useEffect(() => {
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message_created" && data.message) {
          createdRef.current?.(data.message as ChatMessage);
        } else if (data.type === "message_updated" && data.message) {
          updatedRef.current?.(data.message as ChatMessage);
        } else if (data.type === "message_deleted" && data.messageId) {
          deletedRef.current?.(Number(data.messageId));
        } else if (data.type === "presence_snapshot") {
          snapshotRef.current?.(data.members ?? []);
        } else if (data.type === "member_online" && data.member) {
          onlineRef.current?.(data.member as MessageUser);
        } else if (data.type === "member_offline" && data.member) {
          offlineRef.current?.(data.member as MessageUser);
        } else if (data.type === "typing" && data.user) {
          typingRef.current?.({
            community_id: Number(data.community_id),
            user: data.user as MessageUser,
            is_typing: Boolean(data.is_typing),
          });
        }
      } catch {
        // Ignore malformed event payloads.
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 12000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [wsUrl]);

  const sendJson = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendMessage = useCallback(
    (content: string) => sendJson({ type: "message", content }),
    [sendJson]
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => sendJson({ type: "typing", isTyping }),
    [sendJson]
  );

  const editMessage = useCallback(
    (messageId: number, content: string) =>
      sendJson({ type: "edit_message", messageId, content }),
    [sendJson]
  );

  const deleteMessage = useCallback(
    (messageId: number) => sendJson({ type: "delete_message", messageId }),
    [sendJson]
  );

  return {
    connected,
    sendMessage,
    sendTyping,
    editMessage,
    deleteMessage,
  };
}
