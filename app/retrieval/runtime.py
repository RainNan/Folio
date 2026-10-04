"""One shared retrieval snapshot for chat and document mutations in this process."""

from functools import lru_cache
from threading import RLock

from langchain_core.documents import Document

from app.ingest import delete_document, get_store, ingest_file
from app.retrieval.bm25_index import BM25Index
from app.retrieval.hybrid_retriever import HybridRetriever


class RetrievalRuntime:
    def __init__(self, store):
        self.store = store
        self._lock = RLock()
        self._dirty = True
        self._retriever = None
        self.refresh()

    def refresh(self):
        with self._lock:
            result = self.store.get(include=["documents", "metadatas"])
            documents = []
            for chunk_id, content, metadata in zip(
                result["ids"], result["documents"], result["metadatas"]
            ):
                meta = dict(metadata or {})
                # Legacy chunks still have a stable Chroma record ID.
                meta.setdefault("chunk_id", chunk_id)
                documents.append(Document(page_content=content or "", metadata=meta))
            index = BM25Index()
            index.build(documents)
            retriever = HybridRetriever(self.store, index)
            self._retriever = retriever
            self._dirty = False

    def search(self, query: str) -> list[Document]:
        # Keep reads away from partially written/replaced chunk generations.
        with self._lock:
            if self._dirty:
                self.refresh()
            return self._retriever.search(query)

    def ingest_file(self, path, original_name=None):
        with self._lock:
            # A failed mutation may still have changed storage; retry the
            # snapshot before the next query rather than serving stale evidence.
            self._dirty = True
            result = ingest_file(path, self.store, original_name)
            self.refresh()
            return result

    def delete_document(self, doc_id: str):
        with self._lock:
            self._dirty = True
            delete_document(doc_id, store=self.store)
            self.refresh()


@lru_cache(maxsize=1)
def get_retriever() -> RetrievalRuntime:
    return RetrievalRuntime(get_store())
