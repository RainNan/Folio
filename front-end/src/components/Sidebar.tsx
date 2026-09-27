import { BookOpen, Database, RefreshCw, ShieldCheck, X } from "lucide-react";
import { DocumentList } from "./DocumentList";
import { DocumentUpload } from "./DocumentUpload";
import type { DocumentInfo } from "../types";
import type { useDocuments } from "../hooks/useDocuments";

interface Props {
  library: ReturnType<typeof useDocuments>;
  open: boolean;
  onClose: () => void;
  onDelete: (doc: DocumentInfo) => void;
}
export function Sidebar({ library, open, onClose, onDelete }: Props) {
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="关闭资料库"
          onClick={onClose}
        />
      )}
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="文档资料库"
      >
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={23} strokeWidth={1.6} />
          </span>
          <div>
            <strong>
              Folio<span className="brand-period">.</span>
            </strong>
            <span className="brand-subtitle">让知识，触手可及</span>
          </div>
          <button
            className="icon-button mobile-only close-sidebar"
            aria-label="关闭资料库"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-dot" />
          我的知识空间<span className="workspace-tag">个人</span>
        </div>
        <div className="library-heading">
          <h2>
            <Database size={15} />
            文档资料库 <span>{library.documents.length}</span>
          </h2>
          <button
            className="icon-button"
            aria-label="刷新文档列表"
            title="刷新文档列表"
            disabled={library.loading || library.uploading || library.deleting}
            onClick={() => void library.refresh()}
          >
            <RefreshCw size={15} className={library.loading ? "spin" : ""} />
          </button>
        </div>
        <DocumentUpload
          busy={library.uploading || library.deleting}
          uploading={library.uploading}
          onUpload={library.upload}
        />
        {library.error && (
          <div className="library-error" role="alert">
            <p>{library.error}</p>
            <button
              onClick={() => void library.refresh()}
              disabled={library.loading}
            >
              重新连接
            </button>
          </div>
        )}
        <div className="library-scroll">
          <DocumentList
            documents={library.documents}
            loading={library.loading}
            busy={library.uploading || library.deleting}
            onDelete={onDelete}
          />
        </div>
        <div className="sidebar-note">
          <ShieldCheck size={17} />
          <div>
            <strong>答案，源于你的资料</strong>
            <p>
              所有已索引文档均会参与检索
              <br />
              支持文本型 PDF 与 UTF-8 文本
            </p>
          </div>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">F</span>
          <span>
            我的工作空间<small>DOCUMENT WORKSPACE</small>
          </span>
          <span className="version">v1.0</span>
        </div>
      </aside>
    </>
  );
}
