import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api/documents";
import { describeError } from "../api/client";
import type { DocumentInfo, Notice } from "../types";

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mutation = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const data = await api.getDocuments();
      if (current === sequence.current) {
        setDocuments(data);
        setError(null);
      }
    } catch (err) {
      if (current === sequence.current) setError(describeError(err));
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    if (mutation.current) return;
    if (!/\.(txt|md|pdf|docx)$/i.test(file.name)) {
      setNotice({ tone: "error", text: "仅支持 TXT、MD、PDF 和 DOCX 文件。" });
      return;
    }
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setNotice({
        tone: "error",
        text: !file.size
          ? "文件为空，请选择包含文本的文档。"
          : "文件太大了，单个文件不能超过 10 MiB。",
      });
      return;
    }
    mutation.current = true;
    setUploading(true);
    setNotice(null);
    try {
      const result = await api.uploadDocument(file);
      setNotice({
        tone: result.status === "already_exists" ? "info" : "success",
        text: `${result.status === "already_exists" ? "该文件已在资料库中，无需重复上传" : `「${file.name}」已就绪`} · ${result.chunks} 个分块${result.warnings.length ? `。提示：${result.warnings.join("；")}` : ""}`,
      });
      await refresh();
    } catch (err) {
      setNotice({ tone: "error", text: describeError(err) });
    } finally {
      mutation.current = false;
      setUploading(false);
    }
  }
  async function remove(doc: DocumentInfo): Promise<boolean> {
    if (mutation.current) return false;
    mutation.current = true;
    setDeleting(true);
    setNotice(null);
    try {
      await api.deleteDocument(doc.doc_id);
      setNotice({ tone: "success", text: `已删除「${doc.filename}」。` });
      await refresh();
      return true;
    } catch (err) {
      setNotice({ tone: "error", text: describeError(err) });
      return false;
    } finally {
      mutation.current = false;
      setDeleting(false);
    }
  }
  return {
    documents,
    loading,
    error,
    notice,
    uploading,
    deleting,
    refresh,
    upload,
    remove,
    dismissNotice: () => setNotice(null),
  };
}
