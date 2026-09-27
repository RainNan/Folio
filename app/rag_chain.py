from operator import itemgetter

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

from app.config import get_llm
from app.ingest import get_store

prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """
        你是一个基于文档资料和对话历史回答问题的助手。
        
        回答规则：

        1. 如果问题涉及文档中的事实、人物、任务、规则等内容，
           必须仅依据“资料”回答。
        2. 如果资料不足以回答文档相关问题，
           明确回答“资料不足，无法回答”。
        3. 如果问题涉及当前对话本身，例如：
           - 我叫什么
           - 我刚才说了什么
           - 我之前提到过什么
           - 我们上一轮聊了什么
           可以根据对话历史回答。
        4. 不要把对话历史中的信息误认为文档事实。
        5. 不要根据常识或自身知识补充文档中不存在的内容。
        
        资料：
        {data}
        """
    ),
    MessagesPlaceholder("history"),
    ("human", "{question}")
])

llm = get_llm()

vector_store = get_store()
retriever = vector_store.as_retriever()


def convert_results_to_str(results: list[Document]):
    return "\n\n".join(
        result.page_content
        for result in results
    )


rag_chain = (
        {
            "data": itemgetter("question") | retriever | convert_results_to_str,
            "question": itemgetter("question"),
            "history": itemgetter("history")
        }
        | prompt
        | llm
        | StrOutputParser()
)


if __name__ == '__main__':
    # question = "沈禾是谁"
    question = "任务 T313详情"
    history = []
    response = rag_chain.invoke({
        "question": question,
        "history": history
    })
    print(response)
