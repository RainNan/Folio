import { useState } from "react";
import { Info, Menu, PanelsTopLeft } from "lucide-react";
import { useChat } from "../hooks/useChat";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { Welcome } from "./Welcome";

export function ChatWindow({
  documentCount,
  connected,
  onOpenSidebar,
}: {
  documentCount: number;
  connected: boolean | null;
  onOpenSidebar: () => void;
}) {
  const { messages, pending, send } = useChat();
  const [draft, setDraft] = useState("");
  function submit(question: string = draft) {
    if (pending || !question.trim() || question.trim().length > 2000) return;
    setDraft("");
    void send(question);
  }
  return (
    <main className="chat-window">
      <header className="chat-header">
        <div className="chat-title">
          <button
            className="icon-button mobile-only"
            aria-label="打开资料库"
            onClick={onOpenSidebar}
          >
            <Menu size={21} />
          </button>
          <PanelsTopLeft size={18} className="desktop-only" />
          <div>
            <h2>与文档对话</h2>
            <p>每一个问题，都有迹可循</p>
          </div>
        </div>
        <span
          className={`connection-badge ${connected === false ? "offline" : ""}`}
        >
          <span />
          {connected === null
            ? "正在连接"
            : connected
              ? `${documentCount} 份文档可供检索`
              : "服务未连接"}
        </span>
      </header>
      <div className="chat-scroll">
        {messages.length ? (
          <MessageList messages={messages} pending={pending} onRetry={submit} />
        ) : (
          <Welcome
            hasDocuments={documentCount > 0}
            onExample={(question) => {
              setDraft(question);
              document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
            }}
          />
        )}
      </div>
      <ChatInput
        value={draft}
        onChange={setDraft}
        pending={pending}
        onSend={() => submit()}
      />
      <div className="session-note">
        <Info size={12} />
        当前后端使用共享对话上下文；刷新页面仅清空本页显示。
      </div>
    </main>
  );
}
