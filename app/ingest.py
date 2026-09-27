import hashlib
from pathlib import Path
from pypdf import PdfReader
from docx import Document as WordDocument
from docx.text.paragraph import Paragraph
from langchain_core.documents import Document

SUPPORTED = {".txt", ".md", ".pdf", ".docx"}


def parse_file(path: Path, original_name: str | None = None):
    name = original_name or path.name
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED:
        raise ValueError("仅支持 TXT、MD、文本型 PDF、DOCX")
    doc_id = hashlib.sha256(path.read_bytes()).hexdigest()
    docs, warnings = [], []

    def add(text, location):
        if text and text.strip():
            docs.append(Document(
                page_content=text.strip(),
                metadata={"doc_id": doc_id, "source": name,
                          "location": location},
            ))

    if suffix in {".txt", ".md"}:
        add(path.read_text(encoding="utf-8-sig"), "全文")
    elif suffix == ".pdf":
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise ValueError("首版不支持加密 PDF，请先提供可读取文件")
        for i, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            if not text.strip():
                warnings.append(f"PDF 第 {i} 页未提取到文本")
            add(text, f"PDF 物理页 {i}")
    else:
        word = WordDocument(path)
        for i, block in enumerate(word.iter_inner_content(), 1):
            if isinstance(block, Paragraph):
                text = block.text
            else:
                text = "\n".join(
                    " | ".join(cell.text for cell in row.cells)
                    for row in block.rows
                )
            add(text, f"Word 正文块 {i}")
    if not docs:
        raise ValueError("没有提取到有效文本；扫描件需要另行 OCR")
    return doc_id, docs, warnings


from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
)
from langchain_chroma import Chroma
from app.config import DATA, get_embeddings

COLLECTION = "docqa_v1"
# SPLIT_VERSION = "char600_overlap100_v1"
SPLIT_VERSION = "markdown_header_recursive600_v2"


def split_docs(docs) -> list[Document]:
    recursive_splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=80,
        separators=["\n\n", "\n", "。", "！", "？", "；", " ", ""],
        add_start_index=True,
    )

    final_chunks = []

    for doc in docs:
        source = doc.metadata.get("source", "")
        suffix = Path(source).suffix.lower()

        # =========================
        # Markdown：先按标题切
        # =========================
        if suffix == ".md":
            headers_to_split_on = [
                ("#", "h1"),
                ("##", "h2"),
                ("###", "h3"),
                ("####", "h4"),
            ]

            markdown_splitter = MarkdownHeaderTextSplitter(
                headers_to_split_on=headers_to_split_on,
                strip_headers=False,
            )

            header_docs = markdown_splitter.split_text(doc.page_content)

            # MarkdownHeaderTextSplitter 生成的新 Document
            # 不会自动继承原 Document 的 metadata，
            # 所以需要手动合并回来
            for header_doc in header_docs:
                header_doc.metadata = {
                    **doc.metadata,
                    **header_doc.metadata,
                }

            # 某个标题章节如果依然太长，再递归切
            chunks = recursive_splitter.split_documents(header_docs)

        # =========================
        # TXT / PDF / DOCX
        # 暂时继续用递归字符切分
        # =========================
        else:
            chunks = recursive_splitter.split_documents([doc])

        final_chunks.extend(chunks)

    # 统一生成 chunk metadata
    for i, chunk in enumerate(final_chunks):
        meta = chunk.metadata

        meta["chunk_index"] = i
        meta["split_version"] = SPLIT_VERSION
        meta["chunk_id"] = (
            f"{meta['doc_id']}:{SPLIT_VERSION}:{i}"
        )

    return final_chunks


def get_store():
    return Chroma(
        collection_name=COLLECTION,
        embedding_function=get_embeddings(),
        persist_directory=str(DATA / "chroma"),
    )


def list_documents():
    store = get_store()

    result = store._collection.get(
        include=["metadatas"]
    )

    documents = {}

    for metadata in result["metadatas"]:
        doc_id = metadata.get("doc_id")
        source = metadata.get("source")

        if doc_id:
            if doc_id not in documents:
                documents[doc_id] = {"filename": source, "chunks": 0}
            documents[doc_id]["chunks"] += 1

    return [
        {
            "doc_id": doc_id,
            "filename": info["filename"],
            "chunks": info["chunks"]
        }
        for doc_id, info in documents.items()
    ]


def delete_document(doc_id: str):
    store = get_store()

    store._collection.delete(
        where={"doc_id": doc_id}
    )


def ingest_file(path, store, original_name=None):
    doc_id, docs, warnings = parse_file(path, original_name)

    existing = store.get(
        where={"doc_id": doc_id},
        include=["metadatas"]
    )

    if existing["ids"]:
        return {
            "doc_id": doc_id,
            "status": "already_exists",
            "chunks": len(existing["ids"]),
            "warnings": warnings
        }

    chunks = split_docs(docs)

    ids = [
        c.metadata["chunk_id"]
        for c in chunks
    ]

    try:
        for start in range(0, len(chunks), 32):
            store.add_documents(
                chunks[start:start + 32],
                ids=ids[start:start + 32]
            )

    except Exception:
        store.delete(ids=ids)
        raise

    return {
        "doc_id": doc_id,
        "status": "indexed",
        "chunks": len(chunks),
        "warnings": warnings
    }


if __name__ == "__main__":
    import sys

    # python -m app.ingest data/samples/test.md
    # print(ingest_file(Path(sys.argv[1]), get_store()))

    documents = list_documents()

    for doc_id, source in documents.items():
        print(source, doc_id)

    doc_id = input("请输入要删除的 doc_id：")

    delete_document(doc_id)

    print("删除完成")
