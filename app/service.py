from langchain_core.messages import HumanMessage, AIMessage

from app.rag_chain import rag_chain
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.ingest import get_store


class Service:
    def __init__(self):
        self.history = []
        self.store = get_store()

    def chat(self, question: str) -> str:
        response = rag_chain.invoke({
            "history": self.history,
            "question": question
        })

        self.history.append(HumanMessage(question))
        self.history.append(AIMessage(response))
        return response


if __name__ == '__main__':
    history = []
    while True:
        question = input("输入你的问题：")

        response = rag_chain.invoke({
            "history": history,
            "question": question
        })
        print(f"AI: {response}\n")

        history.append(HumanMessage(question))
        history.append(AIMessage(response))
