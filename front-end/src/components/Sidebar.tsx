import {
  BookOpen,
  MessageSquare,
  Plus,
  Search,
  X,
  RefreshCw,
  LoaderCircle,
  Library,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { useChat } from "../hooks/useChat";

export function Sidebar({
  chat,
  open,
  onClose,
  onLibrary,
  documentCount,
}: {
  chat: ReturnType<typeof useChat>;
  open: boolean;
  onClose: () => void;
  onLibrary: () => void;
  documentCount: number;
}) {
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = panel.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input",
        );
        const items = Array.from(nodes || []).filter(
          (n) => n.getClientRects().length,
        );
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open, onClose]);
  const filtered = chat.sessions.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="关闭会话栏遮罩"
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="会话栏"
      >
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={23} />
          </span>
          <div>
            <strong>Folio</strong>
            <span>你的文档工作台</span>
          </div>
          <button
            className="icon-button mobile-only"
            aria-label="关闭会话栏"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <button
          className="new-session"
          disabled={chat.creating || chat.loading}
          onClick={() =>
            void chat.create().then((id) => {
              if (id) {
                setQuery("");
                onClose();
              }
            })
          }
        >
          {chat.creating ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <Plus size={19} />
          )}{" "}
          新建会话
        </button>
        <label className="session-search">
          <Search size={16} />
          <input
            aria-label="搜索会话"
            placeholder="搜索会话"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="session-heading">
          <span>
            所有会话 <small>{chat.sessions.length}</small>
          </span>
          <button
            className="icon-button"
            aria-label="刷新会话列表"
            onClick={() => void chat.refresh()}
          >
            <RefreshCw size={14} />
          </button>
        </div>
        {chat.error && (
          <div className="session-error" role="alert">
            <p>{chat.error}</p>
            <button onClick={() => void chat.refresh()}>重新连接</button>
          </div>
        )}
        <nav className="session-list" aria-label="历史会话">
          {chat.loading ? (
            <p className="nav-empty" role="status">
              正在读取会话…
            </p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.session_id}
                className={`session-item ${chat.activeId === s.session_id ? "active" : ""}`}
                aria-current={
                  chat.activeId === s.session_id ? "page" : undefined
                }
                onClick={() => {
                  chat.select(s.session_id);
                  onClose();
                }}
              >
                <MessageSquare size={16} />
                <span>{s.title || "新对话"}</span>
                {chat.pendingIds.includes(s.session_id) && (
                  <LoaderCircle className="spin" size={14} />
                )}
              </button>
            ))
          )}
          {!chat.loading && !filtered.length && (
            <div className="nav-empty">
              {query ? (
                "没有找到这个会话"
              ) : (
                <>
                  还没有会话<p>每个新问题，都可以有自己的空间。</p>
                </>
              )}
            </div>
          )}
        </nav>
        <button className="library-entry" onClick={onLibrary}>
          <Library size={19} />
          <span>
            文档资料库<small>{documentCount} 份文档 · 所有会话共用</small>
          </span>
        </button>
        <div className="sidebar-footer">
          <span className="avatar">我</span>
          <div>
            个人工作空间<small>专注阅读，保持好奇</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
    </>
  );
}
