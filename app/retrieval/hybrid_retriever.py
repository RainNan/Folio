from collections import defaultdict
from langchain_core.documents import Document


class HybridRetriever:

    def __init__(
            self,
            vector_store,
            bm25_index,
            vector_k: int = 10,
            bm25_k: int = 10,
            final_k: int = 4,
    ):
        self.vector_store = vector_store
        self.bm25_index = bm25_index
        self.vector_k = vector_k
        self.bm25_k = bm25_k
        self.final_k = final_k

    def search(self, query: str):
        vector_docs = self.vector_store.similarity_search(
            query,
            k=self.vector_k
        )

        bm25_docs = self.bm25_index.search(
            query,
            k=self.bm25_k
        )

        return reciprocal_rank_fusion(
            [
                vector_docs,
                bm25_docs
            ],
            weights=[
                1.0,
                1.0
            ],
            top_k=self.final_k
        )

def reciprocal_rank_fusion(
        result_lists: list[list[Document]],
        weights: list[float] | None = None,
        rrf_k: int = 60,
        top_k: int = 4,
) -> list[Document]:
    if weights is None:
        weights = [1.0] * len(result_lists)
    if len(weights) != len(result_lists):
        raise ValueError("weights must match result_lists")
    if rrf_k < 0:
        raise ValueError("rrf_k must be non-negative")
    if top_k <= 0:
        return []

    scores = defaultdict(float)

    document_map: dict[str, Document] = {}

    for documents, weight in zip(result_lists, weights):
        seen = set()
        for rank, doc in enumerate(documents, start=1):
            chunk_id = doc.metadata.get("chunk_id") or doc.id
            if not chunk_id:
                raise ValueError("retrieved document needs a chunk_id or record ID")
            if chunk_id in seen:
                continue
            seen.add(chunk_id)
            if not doc.metadata.get("chunk_id"):
                doc = Document(page_content=doc.page_content, metadata={**doc.metadata, "chunk_id": chunk_id})

            document_map[chunk_id] = doc

            scores[chunk_id] += (
                    weight / (rrf_k + rank)
            )

    ranked_ids = sorted(
        scores,
        key=scores.get,
        reverse=True
    )

    return [
        document_map[chunk_id]
        for chunk_id in ranked_ids[:top_k]
    ]


