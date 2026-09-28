import { request } from "./client";
import type { ChatMessage, DocumentSource, SessionInfo } from "../types";
export const getSessions = () => request<SessionInfo[]>("/sessions");
export const createSession = () =>
  request<SessionInfo>("/sessions", { method: "POST" });
export async function getMessages(id: string): Promise<ChatMessage[]> {
  const rows = await request<{ role: string; content: string; sources?: DocumentSource[] }[]>(
    `/messages?session_id=${encodeURIComponent(id)}`,
  );
  return rows.map((row, index) => ({
    id: `${id}-${index}`,
    role: row.role === "human" ? "user" : "assistant",
    content: row.content,
    sources: Array.isArray(row.sources) ? row.sources : [],
  }));
}
