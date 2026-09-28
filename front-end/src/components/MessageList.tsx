import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, Check, Copy, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, DocumentSource } from "../types";
import { SourceList } from "./SourceList";

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state !== "idle") {
      const timer = setTimeout(() => setState("idle"), 2500);
      return () => clearTimeout(timer);
    }
  }, [state]);
  return (
    <button
      className="message-action"
      aria-label="复制回答"
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => setState("copied"))
          .catch(() => setState("failed"));
      }}
    >
      {state === "copied" ? <Check size={13} /> : <Copy size={13} />}
      {state === "copied"
        ? "已复制"
        : state === "failed"
          ? "复制失败，请手动选择"
          : "复制回答"}
    </button>
  );
}
export function MessageList({
  messages,
  pending,
  onRetry,
  onPreview,
}: {
  messages: ChatMessage[];
  pending: boolean;
  onRetry: (question: string) => void;
  onPreview: (source: DocumentSource) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "end",
    });
  }, [messages, pending]);
  return (
    <div
      className="message-list"
      role="log"
      aria-label="对话消息"
      aria-live="polite"
    >
      {messages.map((message) => (
        <article
          key={message.id}
          className={`message ${message.role} ${message.isError ? "message-error" : ""}`}
        >
          {message.role === "assistant" && (
            <div className="assistant-avatar">
              <BookOpen size={17} />
            </div>
          )}
          <div className="message-main">
            <span className="message-author">
              {message.role === "user" ? "你" : "Folio"}
              {message.role === "assistant" && <span>文档助手</span>}
            </span>
            {message.isError ? (
              <div className="chat-error">
                <AlertCircle size={18} />
                <div>
                  <strong>这次没有顺利获得回答</strong>
                  <p>{message.content}</p>
                  <button
                    className="message-action"
                    disabled={pending}
                    onClick={() => onRetry(message.retryQuestion || "")}
                  >
                    <RotateCcw size={13} />
                    重新提问
                  </button>
                </div>
              </div>
            ) : message.role === "user" ? (
              <div className="user-bubble">{message.content}</div>
            ) : (
              <>
                <div className="markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: (props) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      ),
                      img: (props) => (
                        <span>[图片：{props.alt || "回答中的图片"}]</span>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                <SourceList sources={message.sources || []} onPreview={onPreview} />
                <CopyButton text={message.content} />
              </>
            )}
          </div>
        </article>
      ))}
      {pending && (
        <div className="message assistant">
          <div className="assistant-avatar">
            <BookOpen size={17} />
          </div>
          <div className="message-main">
            <span className="message-author">
              Folio<span>文档助手</span>
            </span>
            <div className="thinking" role="status">
              <span className="thinking-dots">
                <i />
                <i />
                <i />
              </span>
              正在查阅资料，整理答案…
            </div>
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
