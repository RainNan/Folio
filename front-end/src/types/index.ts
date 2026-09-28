export interface DocumentInfo {
  doc_id: string;
  filename: string;
  chunks?: number;
  preview_url?: string | null;
}
export interface UploadDocumentResponse {
  doc_id: string;
  status: "indexed" | "already_exists";
  chunks: number;
  warnings: string[];
  preview_url?: string | null;
}
export interface DeleteDocumentResponse {
  doc_id: string;
  status: "deleted";
}
export interface ChatRequest {
  session_id: string;
  question: string;
}
export interface SessionInfo {
  session_id: string;
  title: string;
  created_at?: string | number;
  updated_at?: string | number;
}
export interface DocumentSource {
  citation_id: number;
  doc_id: string | null;
  chunk_id: string | null;
  source: string;
  location: string;
  page_number?: number | null;
  preview_url?: string | null;
  excerpt: string;
  cited: boolean;
}
export interface ChatResponse {
  answer: string;
  sources: DocumentSource[];
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: DocumentSource[];
  isError?: boolean;
  retryQuestion?: string;
}
export interface Notice {
  tone: "success" | "error" | "info";
  text: string;
}
