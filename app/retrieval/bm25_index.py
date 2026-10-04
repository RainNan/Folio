from rank_bm25 import BM25Okapi
from langchain_core.documents import Document

from app.retrieval.tokenizer import tokenize_zh


class BM25Index:

    def __init__(self):
        self.documents: list[Document] = []
        self.bm25: BM25Okapi | None = None
        self.token_sets: list[set[str]] = []

    def build(self, documents: list[Document]):
        tokenized_corpus = [
            tokenize_zh(doc.page_content)
            for doc in documents
        ]

        # Ignore empty token streams, including an entirely empty collection.
        pairs = [(doc, tokens) for doc, tokens in zip(documents, tokenized_corpus) if tokens]
        self.documents = [doc for doc, _ in pairs]
        self.token_sets = [set(tokens) for _, tokens in pairs]
        self.bm25 = BM25Okapi([tokens for _, tokens in pairs]) if pairs else None

    def search(
        self,
        query: str,
        k: int = 10
    ) -> list[Document]:

        if self.bm25 is None or k <= 0:
            return []

        query_tokens = tokenize_zh(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)

        ranked_indices = sorted(
            (i for i, tokens in enumerate(self.token_sets) if tokens.intersection(query_tokens)),
            key=lambda i: scores[i],
            reverse=True
        )

        return [
            self.documents[i]
            for i in ranked_indices[:k]
        ]
