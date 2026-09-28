export interface DocumentInfo {
  doc_id: string;
  filename: string;
  chunks?: number;
}
export interface UploadDocumentResponse {
  doc_id: string;
  status: "indexed" | "already_exists";
  chunks: number;
  warnings: string[];
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
// FastAPI returns a JSON string, not an { answer } object.
export type ChatResponse = string;
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  retryQuestion?: string;
}
export interface Notice {
  tone: "success" | "error" | "info";
  text: string;
}
