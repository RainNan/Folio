import { useLayoutEffect, useRef } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pending: boolean;
}
export function ChatInput({ value, onChange, onSend, pending }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (field) {
      field.style.height = "auto";
      field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
    }
  }, [value]);
  return (
    <div className="composer-area">
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && value.trim() && value.trim().length <= 2000) onSend();
        }}
      >
        <textarea
          ref={ref}
          aria-label="输入你的问题"
          placeholder="这份文档里，有什么值得了解？"
          value={value}
          rows={1}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.keyCode !== 229
            ) {
              event.preventDefault();
              if (!pending && value.trim() && value.trim().length <= 2000)
                onSend();
            }
          }}
        />
        <div className="composer-bottom">
          <span className="input-hint">
            基于文档回答<span>·</span>Enter 发送，Shift + Enter 换行
          </span>
          <div className="send-group">
            <span
              className={`character-count ${value.trim().length > 2000 ? "over-limit" : ""}`}
              aria-live="polite"
            >
              {value.length > 0 && `${value.trim().length} / 2000`}
            </span>
            <button
              type="submit"
              className="send-button"
              aria-label="发送问题"
              disabled={pending || !value.trim() || value.trim().length > 2000}
            >
              {pending ? (
                <LoaderCircle size={19} className="spin" />
              ) : (
                <ArrowUp size={21} />
              )}
            </button>
          </div>
        </div>
      </form>
      <p className="composer-disclaimer">
        AI 回答可能存在偏差，请结合原始文档核实重要信息。
      </p>
    </div>
  );
}
