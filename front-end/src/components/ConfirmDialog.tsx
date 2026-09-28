import { useEffect, useRef } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { DocumentInfo } from "../types";

interface Props {
  document: DocumentInfo | null;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}
export function ConfirmDialog({ document, busy, error, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (document && !ref.current?.open) ref.current?.showModal();
    else if (!document) ref.current?.close();
  }, [document]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="danger-icon">
        <Trash2 size={22} />
      </div>
      <h2 id="delete-title">删除这份文档？</h2>
      <p id="delete-description">
        「{document?.filename}
        」及其所有分块将从资料库移除{document?.preview_url ? "，保存的 PDF 预览也会删除" : ""}，后续检索将不再使用这份资料。此操作无法撤销。
      </p>
      {error && <div className="library-error" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button
          className="secondary-button"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          保留文档
        </button>
        <button className="danger-button" disabled={busy} onClick={onConfirm}>
          {busy && <LoaderCircle size={16} className="spin" />}
          {busy ? "正在删除…" : "确认删除"}
        </button>
      </div>
    </dialog>
  );
}
