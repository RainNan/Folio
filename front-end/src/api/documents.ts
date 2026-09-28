import { ApiError, apiURL, request } from "./client";
import type {
  DeleteDocumentResponse,
  DocumentInfo,
  UploadDocumentResponse,
} from "../types";

export const getDocuments = () => request<DocumentInfo[]>("/documents");
export function uploadDocument(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<UploadDocumentResponse>("/documents", {
    method: "POST",
    body: form,
  });
}
export const deleteDocument = (id: string) =>
  request<DeleteDocumentResponse>(`/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export async function getPreview(path: string, signal: AbortSignal): Promise<Blob> {
  // Only accept the backend's document preview route, never an arbitrary URL.
  if (!/^\/documents\/[a-f0-9]{64}\/preview$/.test(path))
    throw new ApiError("文档预览地址无效，请刷新资料库。", 0);
  const response = await fetch(apiURL(path), { signal });
  if (response.status === 404)
    throw new ApiError("预览已不存在，文档可能已删除。请刷新资料库。", 404);
  if (!response.ok)
    throw new ApiError("无法加载文档预览，请稍后重试。", response.status);
  const blob = await response.blob();
  if (!blob.size || !blob.type.toLowerCase().startsWith("application/pdf"))
    throw new ApiError("服务未返回有效的 PDF 预览。", 0);
  return blob;
}
