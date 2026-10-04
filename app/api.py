import logging

from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from app.config import DATA
from app.ingest import SUPPORTED, list_documents, preview_path
from app.service import Service

import app.db as db

logger = logging.getLogger(__name__)
app = FastAPI(title="基于文档的问答助手")
MAX_BYTES = 10 * 1024 * 1024
UPLOADS = DATA / "uploads"
UPLOADS.mkdir(exist_ok=True)
service = Service()


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=2000)


@app.post("/documents")
def upload_document(file: UploadFile):
    """
    上传文档
    :param file:
    :return:
    """
    name = (file.filename or "").replace("\\", "/").split("/")[-1]
    suffix = Path(name).suffix.lower()
    if not name or suffix not in SUPPORTED:
        raise HTTPException(400, "只支持 TXT、MD、PDF、DOCX")
    path = UPLOADS / f"{uuid4().hex}{suffix}"
    total = 0
    try:
        with path.open("wb") as out:
            while data := file.file.read(1024 * 1024):
                total += len(data)
                if total > MAX_BYTES:
                    raise HTTPException(413, "单文件不能超过 10 MiB")
                out.write(data)
        if total == 0:
            raise HTTPException(400, "文件不能为空")
        # with service.lock:
        return service.retriever.ingest_file(path, original_name=name)
    except HTTPException:
        raise
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(400, str(exc)) from exc
    # except Exception as exc:
    #     # 实际项目补充服务端日志，避免向客户端暴露密钥或内部路径。
    #     raise HTTPException(500, "导入失败，请检查文件和模型服务") from exc
    except Exception as exc:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"{type(exc).__name__}: {exc}"
        ) from exc

    finally:
        file.file.close()
        path.unlink(missing_ok=True)


@app.get("/documents")
def get_documents():
    documents = list_documents()
    return documents


@app.get("/messages")
def get_messages(session_id: str):
    return db.get_messages(session_id)


@app.get("/documents/{doc_id}/preview")
def get_document_preview(doc_id: str):
    try:
        path = preview_path(doc_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not path.is_file():
        raise HTTPException(404, "文档预览不存在")
    return FileResponse(path, media_type="application/pdf")


@app.delete("/documents/{doc_id}")
def remove_document(doc_id: str):
    if len(doc_id) != 64 or any(c not in "0123456789abcdef" for c in doc_id):
        raise HTTPException(400, "无效的文档 ID")
    service.retriever.delete_document(doc_id)
    return {"doc_id": doc_id, "status": "deleted"}


@app.post("/chat")
def chat(body: ChatRequest):
    session_id = body.session_id.strip()
    question = body.question.strip()

    if not session_id:
        raise HTTPException(400, "会话 ID 不能为空")
    if not question:
        raise HTTPException(400, "问题不能为空白")
    if not db.session_exists(session_id):
        raise HTTPException(404, "会话不存在")

    try:
        response = service.chat(session_id, question)

        first_turn = db.add_chat_turn(
            session_id, question, response["answer"], response["sources"],
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.exception("回答生成或保存失败，session_id=%s", session_id)
        raise HTTPException(502, "回答生成或保存失败，请稍后重试") from exc

    if first_turn:
        try:
            service.update_session_title(session_id, question)
        except Exception:
            logger.exception("生成会话标题失败，session_id=%s", session_id)

    return response


@app.post("/sessions")
def create_session():
    session_id = uuid4().hex
    title = "新对话"
    db.add_session(session_id, title)
    return {"session_id": session_id, "title": title}


@app.get("/sessions")
def get_sessions():
    return db.get_sessions()
