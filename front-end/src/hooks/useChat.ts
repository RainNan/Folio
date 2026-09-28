import { useCallback, useEffect, useRef, useState } from "react";
import { sendQuestion } from "../api/chat";
import * as api from "../api/sessions";
import { describeError } from "../api/client";
import type { ChatMessage, SessionInfo } from "../types";

type Conversation = {
  messages: ChatMessage[];
  pending: boolean;
  loading: boolean;
  error: string | null;
};
const empty = (): Conversation => ({
  messages: [],
  pending: false,
  loading: false,
  error: null,
});
const storageKey = "folio.activeSession";
export function useChat() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<
    Record<string, Conversation>
  >({});
  const cache = useRef<Record<string, Conversation>>({});
  const versions = useRef<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const listVersion = useRef(0);
  const initialized = useRef(false);

  const update = useCallback((id: string, patch: Partial<Conversation>) => {
    cache.current = {
      ...cache.current,
      [id]: { ...(cache.current[id] || empty()), ...patch },
    };
    setConversations(cache.current);
  }, []);
  const select = useCallback((id: string | null) => {
    setActiveId(id);
    try {
      if (id) localStorage.setItem(storageKey, id);
      else localStorage.removeItem(storageKey);
    } catch {
      /* storage is optional */
    }
  }, []);
  const load = useCallback(
    async (id: string) => {
      if (cache.current[id]?.pending) return;
      const version = (versions.current[id] = (versions.current[id] || 0) + 1);
      update(id, { loading: true, error: null });
      try {
        const messages = await api.getMessages(id);
        if (versions.current[id] === version)
          update(id, { messages, loading: false });
      } catch (err) {
        if (versions.current[id] === version)
          update(id, { error: describeError(err), loading: false });
      }
    },
    [update],
  );
  const refresh = useCallback(async () => {
    const version = ++listVersion.current;
    try {
      const rows = await api.getSessions();
      if (version !== listVersion.current) return;
      setSessions(rows);
      setError(null);
      if (!initialized.current) {
        initialized.current = true;
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(storageKey);
        } catch {
          /* storage is optional */
        }
        select(
          rows.find((s) => s.session_id === saved)?.session_id ||
            rows[0]?.session_id ||
            null,
        );
      }
    } catch (err) {
      if (version === listVersion.current) setError(describeError(err));
    } finally {
      if (version === listVersion.current) setLoading(false);
    }
  }, [select]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (activeId) void load(activeId);
  }, [activeId, load]);

  async function create() {
    if (creatingRef.current) return null;
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const session = await api.createSession();
      ++listVersion.current;
      initialized.current = true;
      setSessions((rows) => [session, ...rows]);
      update(session.session_id, empty());
      select(session.session_id);
      return session.session_id;
    } catch (err) {
      setError(describeError(err));
      return null;
    } finally {
      creatingRef.current = false;
      setCreating(false);
      setLoading(false);
    }
  }
  async function send(value: string, retry = false) {
    const question = value.trim();
    if (!question || question.length > 2000 || creatingRef.current)
      return false;
    const id = activeId || (await create());
    if (
      !id ||
      cache.current[id]?.pending ||
      cache.current[id]?.loading ||
      cache.current[id]?.error
    )
      return false;
    versions.current[id] = (versions.current[id] || 0) + 1;
    let previous = cache.current[id]?.messages || [];
    if (retry && previous[previous.length - 1]?.isError)
      previous = previous.slice(0, -2);
    const messages: ChatMessage[] = [
      ...previous,
      { id: crypto.randomUUID(), role: "user", content: question },
    ];
    update(id, { messages, pending: true });
    try {
      const answer = await sendQuestion({ session_id: id, question });
      update(id, {
        messages: [
          ...messages,
          { id: crypto.randomUUID(), role: "assistant", content: answer },
        ],
        pending: false,
      });
      void refresh();
    } catch (err) {
      update(id, {
        messages: [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: describeError(err),
            isError: true,
            retryQuestion: question,
          },
        ],
        pending: false,
      });
    }
    return true;
  }
  return {
    sessions,
    activeId,
    select,
    create,
    creating,
    loading,
    error,
    refresh,
    load,
    send,
    current: activeId ? conversations[activeId] || empty() : empty(),
    activeSession: sessions.find((s) => s.session_id === activeId),
    pendingIds: Object.keys(conversations).filter(
      (id) => conversations[id].pending,
    ),
  };
}
