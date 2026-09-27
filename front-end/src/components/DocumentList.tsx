import { FileText, Files, LoaderCircle, Trash2 } from "lucide-react";
import type { DocumentInfo } from "../types";

interface Props {
  documents: DocumentInfo[];
  loading: boolean;
  busy: boolean;
  onDelete: (doc: DocumentInfo) => void;
}
export function DocumentList({ documents, loading, busy, onDelete }: Props) {
  if (loading && !documents.length)
    return (
      <div className="sidebar-empty" role="status">
        <LoaderCircle className="spin" size={24} />
        <p>正在读取资料库…</p>
      </div>
    );
  if (!documents.length)
    return (
      <div className="sidebar-empty">
        <Files size={30} strokeWidth={1.3} />
        <p>给灵感一些依据</p>
        <span>
          上传第一份文档
          <br />
          开始与你的资料对话
        </span>
      </div>
    );
  return (
    <ul className="document-list">
      {documents.map((doc) => (
        <li key={doc.doc_id} className="document-card">
          <div
            className={`file-icon ${doc.filename?.toLowerCase().endsWith(".pdf") ? "pdf" : ""}`}
          >
            <FileText size={19} strokeWidth={1.6} />
          </div>
          <div className="document-details">
            <p className="document-name" title={doc.filename}>
              {doc.filename || "未命名文档"}
            </p>
            <span className="document-meta">
              {typeof doc.chunks === "number"
                ? `${doc.chunks} 个分块`
                : "分块数未提供"}
              <span className="tiny-dot" />
              已索引
            </span>
            <details>
              <summary>查看文档 ID</summary>
              <code className="document-id">{doc.doc_id}</code>
            </details>
          </div>
          <button
            className="icon-button delete-button"
            disabled={busy}
            aria-label={`删除 ${doc.filename}`}
            title="删除文档"
            onClick={() => onDelete(doc)}
          >
            <Trash2 size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}
