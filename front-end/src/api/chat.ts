import { ApiError, request } from "./client";
import type { ChatRequest, ChatResponse } from "../types";

export async function sendQuestion(body: ChatRequest): Promise<ChatResponse> {
  const answer = await request<ChatResponse>("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (typeof answer !== "string" || !answer.trim())
    throw new ApiError("模型未返回有效回答，请重试。", 0);
  return answer;
}
