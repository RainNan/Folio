import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
from pypdf import PdfReader
from langchain_core.documents import Document
from app.config import DATA, get_embeddings
from app.office_runtime import install_lock
from tools.word import docx_to_pdf

SUPPORTED = {".txt", ".md", ".pdf", ".docx"}
PREVIEWS = DATA / "previews"
DOCX_PARSE_VERSION = "docx_pdf_v1"


def preview_path(doc_id: str) -> Path:
    if len(doc_id) != 64 or any(c not in "0123456789abcdef" for c in doc_id):
        raise ValueError("无效的文档 ID")
    return PREVIEWS / f"{doc_id}.pdf"


def document_lock(doc_id: str):
    preview_path(doc_id)  # Validate before constructing a filesystem path.
    locks = DATA / "document_locks"
    locks.mkdir(parents=True, exist_ok=True)
    return install_lock(locks / f"{doc_id}.lock")


def _parse_file(path: Path, original_name: str | None = None, *, pdf_path: Path | None = None):
    """
    把文档转为LangChain的Document
    """
    name = original_name or path.name
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED:
        raise ValueError("仅支持 TXT、MD、文本型 PDF、DOCX")
    doc_id = hashlib.sha256(path.read_bytes()).hexdigest()
    docs, warnings = [], []

    def add(text, location="", **metadata):
        if text and text.strip():
            docs.append(Document(
                page_content=text.strip(),
                metadata={
                    "doc_id": doc_id,
                    "source": name,
                    "location": location,
                    **metadata,
                },
            ))

    if suffix in {".txt", ".md"}:
        add(path.read_text(encoding="utf-8-sig"))
    else:
        if suffix == ".docx" and pdf_path is None:
            raise ValueError("DOCX 需要通过 ingest_file 转为 PDF 后解析")
        reader = PdfReader(pdf_path if suffix == ".docx" else path)
        if reader.is_encrypted:
            raise ValueError("首版不支持加密 PDF，请先提供可读取文件")
        for i, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            if not text.strip():
                warnings.append(f"PDF 第 {i} 页未提取到文本")
            extra = {"page_number": i}
            if suffix == ".docx":
                extra.update(
                    parse_version=DOCX_PARSE_VERSION,
                    preview_url=f"/documents/{doc_id}/preview",
                )
            add(text, f"PDF 物理页 {i}", **extra)
    if not docs:
        raise ValueError("没有提取到有效文本；扫描件需要另行 OCR")
    return doc_id, docs, warnings


from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
)
from langchain_chroma import Chroma

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
                metadata = {**doc.metadata, **header_doc.metadata}
                headings = [
                    metadata[key]
                    for key in ("h1", "h2", "h3", "h4")
                    if metadata.get(key)
                ]
                metadata["location"] = " > ".join(headings) if headings else "全文"

                header_doc.metadata = metadata

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
            f"{meta['doc_id']}:{SPLIT_VERSION}:"
            f"{meta['parse_version'] + ':' if 'parse_version' in meta else ''}{i}"
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
            "chunks": info["chunks"],
            "preview_url": f"/documents/{doc_id}/preview" if preview_path(doc_id).is_file() else None,
        }
        for doc_id, info in documents.items()
    ]


def delete_document(doc_id: str, store=None):
    if store is None:
        store = get_store()
    with document_lock(doc_id):
        store.delete(where={"doc_id": doc_id})
        preview_path(doc_id).unlink(missing_ok=True)


def ingest_file(path, store, original_name=None):
    path = Path(path)
    if path.suffix.lower() not in SUPPORTED:
        raise ValueError("仅支持 TXT、MD、文本型 PDF、DOCX")
    doc_id = hashlib.sha256(path.read_bytes()).hexdigest()
    with document_lock(doc_id):
        return _ingest_file_locked(path, store, original_name, doc_id)


def _ingest_file_locked(path, store, original_name, doc_id):
    is_docx = path.suffix.lower() == ".docx"
    saved_pdf = preview_path(doc_id)

    existing = store.get(
        where={"doc_id": doc_id},
        include=["metadatas"]
    )

    current = not is_docx or (
        saved_pdf.is_file()
        and all(m and m.get("parse_version") == DOCX_PARSE_VERSION
                for m in existing["metadatas"])
    )
    if existing["ids"] and current:
        return {
            "doc_id": doc_id,
            "status": "already_exists",
            "chunks": len(existing["ids"]),
            "warnings": [],
            "preview_url": f"/documents/{doc_id}/preview" if is_docx else None,
        }

    PREVIEWS.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".convert-", dir=PREVIEWS) as work:
        parsed_pdf = None
        if is_docx:
            parsed_pdf = saved_pdf if saved_pdf.is_file() else docx_to_pdf(path, Path(work))
        _, docs, warnings = _parse_file(path, original_name, pdf_path=parsed_pdf)
        chunks = split_docs(docs)
        # A new generation keeps a failed reindex from overwriting existing chunks.
        if existing["ids"]:
            from uuid import uuid4
            generation = uuid4().hex
            for chunk in chunks:
                chunk.metadata["chunk_id"] += f":{generation}"
        ids = [c.metadata["chunk_id"] for c in chunks]
        try:
            for start in range(0, len(chunks), 32):
                store.add_documents(chunks[start:start + 32], ids=ids[start:start + 32])
            if is_docx and parsed_pdf != saved_pdf:
                parsed_pdf.replace(saved_pdf)
        except Exception:
            store.delete(ids=ids)
            raise
        if existing["ids"]:
            store.delete(ids=existing["ids"])

    return {
        "doc_id": doc_id,
        "status": "indexed",
        "chunks": len(chunks),
        "warnings": warnings,
        "preview_url": f"/documents/{doc_id}/preview" if is_docx else None,
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
