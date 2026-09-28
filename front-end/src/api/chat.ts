import { ApiError, request } from "./client";
import type { ChatRequest, ChatResponse } from "../types";

export async function sendQuestion(body: ChatRequest): Promise<ChatResponse> {
  const payload = await request<ChatResponse | string>("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = typeof payload === "string" ? { answer: payload, sources: [] } : payload;
  if (!result || typeof result.answer !== "string" || !result.answer.trim())
    throw new ApiError("模型未返回有效回答，请重试。", 0);
  return { answer: result.answer, sources: Array.isArray(result.sources) ? result.sources : [] };
}
