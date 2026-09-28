import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleCheck,
  Info,
  Library,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DocumentUpload } from "./components/DocumentUpload";
import { DocumentList } from "./components/DocumentList";
import { useDocuments } from "./hooks/useDocuments";
import { useChat } from "./hooks/useChat";
import type { DocumentInfo } from "./types";

export default function App() {
  const library = useDocuments();
  const chat = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [toDelete, setToDelete] = useState<DocumentInfo | null>(null);
  const libraryDialog = useRef<HTMLDialogElement>(null);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  useEffect(() => {
    if (libraryOpen) libraryDialog.current?.showModal();
    else libraryDialog.current?.close();
  }, [libraryOpen]);
  const openLibrary = () => {
    setSidebarOpen(false);
    setLibraryOpen(true);
  };
  const notice = library.notice && (
    <div
      className={`notice ${library.notice.tone}`}
      role={library.notice.tone === "error" ? "alert" : "status"}
    >
      {library.notice.tone === "error" ? (
        <TriangleAlert size={19} />
      ) : library.notice.tone === "success" ? (
        <CircleCheck size={19} />
      ) : (
        <Info size={19} />
      )}
      <p>{library.notice.text}</p>
      <button
        className="icon-button"
        aria-label="关闭提示"
        onClick={library.dismissNotice}
      >
        <X size={16} />
      </button>
    </div>
  );
  return (
    <div className="app-shell">
      <Sidebar
        chat={chat}
        open={sidebarOpen}
        onClose={closeSidebar}
        onLibrary={openLibrary}
        documentCount={library.documents.length}
      />
      <ChatWindow
        chat={chat}
        documentCount={library.documents.length}
        onOpenSidebar={() => setSidebarOpen(true)}
        onLibrary={openLibrary}
      />
      <dialog
        ref={libraryDialog}
        className="library-dialog"
        aria-labelledby="library-title"
        onCancel={() => setLibraryOpen(false)}
      >
        <div className="panel-header">
          <div>
            <Library size={21} />
            <h2 id="library-title">文档资料库</h2>
          </div>
          <button
            className="icon-button"
            autoFocus
            aria-label="关闭资料库"
            onClick={() => setLibraryOpen(false)}
          >
            <X size={21} />
          </button>
        </div>
        <p className="panel-description">
          所有会话共用这些资料。添加或删除文档，会影响之后的回答。
        </p>
        <DocumentUpload
          busy={library.uploading || library.deleting}
          uploading={library.uploading}
          onUpload={library.upload}
        />
        <div className="library-heading">
          <h3>
            已添加的文档 <span>{library.documents.length}</span>
          </h3>
          <button
            className="icon-button"
            aria-label="刷新文档列表"
            disabled={library.loading || library.uploading || library.deleting}
            onClick={() => void library.refresh()}
          >
            <RefreshCw size={16} className={library.loading ? "spin" : ""} />
          </button>
        </div>
        {library.error && (
          <div className="library-error" role="alert">
            <p>{library.error}</p>
            <button onClick={() => void library.refresh()}>重新连接</button>
          </div>
        )}
        <div className="library-scroll">
          <DocumentList
            documents={library.documents}
            loading={library.loading}
            busy={library.uploading || library.deleting}
            onDelete={(doc) => {
              library.dismissNotice();
              setToDelete(doc);
            }}
          />
        </div>
        {libraryOpen && notice}
      </dialog>
      {!libraryOpen && notice}
      <ConfirmDialog
        document={toDelete}
        busy={library.deleting}
        error={
          library.notice?.tone === "error" ? library.notice.text : undefined
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete)
            void library.remove(toDelete).then((success) => {
              if (success) setToDelete(null);
            });
        }}
      />
    </div>
  );
}
