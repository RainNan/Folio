import { useState } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { useDocuments } from "./hooks/useDocuments";
import type { DocumentInfo } from "./types";

export default function App() {
  const library = useDocuments();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toDelete, setToDelete] = useState<DocumentInfo | null>(null);
  return (
    <div className="app-shell">
      <Sidebar
        library={library}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onDelete={(doc) => { library.dismissNotice(); setToDelete(doc); }}
      />
      <ChatWindow
        documentCount={library.documents.length}
        connected={library.error ? false : library.loading ? null : true}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
      {library.notice && (
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
      )}
      <ConfirmDialog
        document={toDelete}
        busy={library.deleting}
        error={library.notice?.tone === "error" ? library.notice.text : undefined}
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
