import { useRef, useState } from "react";
import { sendQuestion } from "../api/chat";
import { describeError } from "../api/client";
import type { ChatMessage } from "../types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function send(value: string) {
    const question = value.trim();
    if (!question || question.length > 2000 || busy.current) return false;
    busy.current = true;
    setPending(true);
    setMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), role: "user", content: question },
    ]);
    try {
      const answer = await sendQuestion({ question });
      setMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "assistant", content: answer },
      ]);
    } catch (err) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: describeError(err),
          isError: true,
          retryQuestion: question,
        },
      ]);
    } finally {
      busy.current = false;
      setPending(false);
    }
    return true;
  }
  return { messages, pending, send };
}
