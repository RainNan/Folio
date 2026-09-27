import { request } from "./client";
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
