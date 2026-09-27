from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
import os

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)


def get_llm(temperature=0.0):
    return ChatOpenAI(
        temperature=temperature,
        model=os.getenv("CHAT_MODEL"),
        api_key=os.getenv("CHAT_API_KEY"),
        base_url=os.getenv("CHAT_BASE_URL"),
        timeout=45,
        max_retries=1,
    )


def get_embeddings():
    return OpenAIEmbeddings(
        model=os.getenv("EMBEDDING_MODEL"),
        api_key=os.getenv("CHAT_API_KEY"),
        base_url=os.getenv("EMBEDDING_BASE_URL"),
        check_embedding_ctx_length=False,
        chunk_size=10,
        request_timeout=45,
        max_retries=1,
    )
