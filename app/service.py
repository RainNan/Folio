from langchain_core.messages import HumanMessage, AIMessage

from app.rag_chain import rag_chain, title_chain
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.ingest import get_store

import app.db as db


class Service:
    def __init__(self):
        self.history = []
        self.store = get_store()
        db.init_db()

    def chat(self,
             session_id: str,
             question: str
             ) -> dict:
        messages = db.get_messages(session_id)
        history = _format_messages_to_langchain(messages)

        response = rag_chain.invoke({
            "history": history,
            "question": question
        })

        return response

    def update_session_title(self, session_id: str, question: str) -> None:
        """根据首轮问题生成标题。"""
        title = title_chain.invoke({"question": question}).strip()
        if title:
            db.update_title(session_id, title)


def _format_messages_to_langchain(messages: list) -> list:
    """
    把SQLite的消息列表轉為Langchain的

    :param messages: SQLite的消息列表
    :return: Langchain消息列表（歷史上下文）
    """
    history = []

    for message in messages:
        role = message['role']
        content = message['content']

        if role == 'ai':
            history.append(AIMessage(content))
        elif role == 'human':
            history.append(HumanMessage(content))

    return history


# if __name__ == '__main__':
# history = []
# while True:
#     question = input("输入你的问题：")
#
#     response = rag_chain.invoke({
#         "history": history,
#         "question": question
#     })
#     print(f"AI: {response}\n")
#
#     history.append(HumanMessage(question))
#     history.append(AIMessage(response))
