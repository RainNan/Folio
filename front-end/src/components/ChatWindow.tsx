import { useState } from "react";
import {
  Library,
  Menu,
  MessageSquare,
  RefreshCw,
  LoaderCircle,
} from "lucide-react";
import type { useChat } from "../hooks/useChat";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { Welcome } from "./Welcome";

export function ChatWindow({
  chat,
  documentCount,
  onOpenSidebar,
  onLibrary,
}: {
  chat: ReturnType<typeof useChat>;
  documentCount: number;
  onOpenSidebar: () => void;
  onLibrary: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const key = chat.activeId || "new";
  const draft = drafts[key] || "";
  const setDraft = (value: string) =>
    setDrafts((d) => ({ ...d, [key]: value }));
  const { messages, pending, loading, error } = chat.current;
  const disabled =
    pending || loading || !!error || chat.creating || chat.loading;
  function submit(question = draft, retry = false) {
    if (disabled || !question.trim() || question.trim().length > 2000) return;
    setDraft("");
    void chat.send(question, retry).then((sent) => {
      if (!sent) setDrafts((d) => ({ ...d, [key]: question }));
    });
  }
  return (
    <main className="chat-window">
      <header className="chat-header">
        <button
          className="icon-button mobile-only"
          aria-label="打开会话栏"
          onClick={onOpenSidebar}
        >
          <Menu size={21} />
        </button>
        <div className="chat-title">
          <MessageSquare size={18} />
          <div>
            <h2>{chat.activeSession?.title || "新对话"}</h2>
            <p>
              {chat.activeId
                ? "独立会话 · 历史自动保存"
                : "开始一次与文档的对话"}
            </p>
          </div>
        </div>
        <button className="library-toggle" onClick={onLibrary}>
          <Library size={17} />
          <span>资料库</span>
          <b>{documentCount}</b>
        </button>
      </header>
      <div className="chat-scroll">
        {loading ? (
          <div className="conversation-state" role="status">
            <LoaderCircle className="spin" size={24} />
            <p>正在读取这个会话…</p>
          </div>
        ) : error ? (
          <div className="conversation-state" role="alert">
            <p>{error}</p>
            <button
              className="secondary-button"
              onClick={() => chat.activeId && void chat.load(chat.activeId)}
            >
              <RefreshCw size={16} />
              重新加载历史
            </button>
          </div>
        ) : messages.length ? (
          <MessageList
            key={key}
            messages={messages}
            pending={pending}
            onRetry={(q) => submit(q, true)}
          />
        ) : (
          <Welcome
            hasDocuments={documentCount > 0}
            onLibrary={onLibrary}
            onExample={(q) => {
              setDraft(q);
              document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
            }}
          />
        )}
      </div>
      <ChatInput
        value={draft}
        onChange={setDraft}
        pending={disabled}
        onSend={() => submit()}
      />
    </main>
  );
}
