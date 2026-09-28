import re

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda

from app.config import get_llm
from app.ingest import get_store
from app.prompts.PROMPTS import rag_prompt,title_prompt

llm = get_llm()

vector_store = get_store()
retriever = vector_store.as_retriever()


def convert_results_to_str(results: list[Document]) -> str:
    passages = []

    for i, doc in enumerate(results, start=1):
        meta = doc.metadata
        source = meta.get("source") or "未知文档"
        location = meta.get("location") or "位置未记录"

        passages.append(
            f"[{i}]\n"
            f"文档：{source}\n"
            f"位置：{location}\n"
            f"正文：\n{doc.page_content}"
        )

    return "\n\n".join(passages)


answer_chain = rag_prompt | llm | StrOutputParser()


def answer_question(inputs: dict) -> dict:
    documents = retriever.invoke(inputs["question"])
    answer = answer_chain.invoke({
        **inputs, "data": convert_results_to_str(documents),
    })
    if not answer.strip() or answer.strip() == "error":
        raise RuntimeError("模型未返回有效回答")
    cited = {int(number) for number in re.findall(r"\[(\d+)\]", answer)}
    sources = []
    for number, document in enumerate(documents, 1):
        meta = document.metadata
        page = meta.get("page_number")
        sources.append({
            "citation_id": number,
            "doc_id": meta.get("doc_id"),
            "chunk_id": meta.get("chunk_id"),
            "source": meta.get("source") or "未知文档",
            "location": meta.get("location") or "位置未记录",
            "page_number": page if isinstance(page, int) and page > 0 else None,
            "preview_url": meta.get("preview_url"),
            "excerpt": document.page_content,
            "cited": number in cited,
        })
    # Unknown model-written numbers never become fabricated source records.
    return {"answer": answer, "sources": sources}


rag_chain = RunnableLambda(answer_question)

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
