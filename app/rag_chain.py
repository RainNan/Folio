from operator import itemgetter

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

from app.config import get_llm
from app.ingest import get_store
from app.PROMPTS import rag_prompt,title_prompt

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
        | rag_prompt
        | llm
        | StrOutputParser()
)

title_chain = (
    title_prompt
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
