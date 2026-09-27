from pathlib import Path

from app.config import get_llm
from app.ingest import parse_file

# print(parse_file(Path("data/samples/course_a.md")))


from app.ingest import get_store
store = get_store()
for doc in store.similarity_search("沈禾是谁", k=4):
    print(doc.metadata)
    print(doc.page_content)