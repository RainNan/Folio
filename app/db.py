import sqlite3
from datetime import datetime, UTC

from app.config import DATA

DB_PATH = DATA / "sqlite" / "app.db"


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)

        # 兼容早期版本的列名拼写，保留已有会话与消息。
        columns = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
        if "titile" in columns and "title" not in columns:
            conn.execute("ALTER TABLE sessions RENAME COLUMN titile TO title")

        conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES sessions(session_id)
        )
        """)


def add_session(
        session_id: str,
        title: str = "新对话",
):
    """
    新建会话
    """
    now = datetime.now(UTC).timestamp()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO sessions (session_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, title, now, now),
        )


def get_sessions() -> list[dict]:
    """
    获取会话列表
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT session_id, title, created_at, updated_at
            FROM sessions
            ORDER BY updated_at DESC, session_id DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]


def add_message(
        session_id: str,
        role: str,
        content: str
):
    """
    消息添加至指定会话id
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO messages(
                session_id,
                role,
                content,
                created_at
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                session_id,
                role,
                content,
                datetime.now(UTC).timestamp()
            )
        )


def get_messages(session_id: str) -> list:
    """
    根据会话id获取消息列表
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT role, content, created_at
            FROM messages
            WHERE session_id = ?
            ORDER BY id ASC
            """,
            (session_id,)
        ).fetchall()

        return [dict(row) for row in rows]


def add_chat_turn(session_id: str, question: str, answer: str) -> bool:
    """保存一轮问答，并返回它是否为该会话的首轮。"""
    now = datetime.now(UTC).timestamp()

    with sqlite3.connect(DB_PATH) as conn:
        # 同一连接、同一事务；任一步抛异常，前面的写入会回滚。
        updated = conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
            (now, session_id),
        )
        if updated.rowcount == 0:
            raise ValueError("会话不存在")

        first_turn = conn.execute(
            "SELECT NOT EXISTS(SELECT 1 FROM messages WHERE session_id = ?)",
            (session_id,),
        ).fetchone()[0] == 1

        conn.execute(
            """
            INSERT INTO messages (session_id, role, content, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, "human", question, now),
        )
        conn.execute(
            """
            INSERT INTO messages (session_id, role, content, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, "ai", answer, now),
        )

    return first_turn


def session_exists(session_id: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT 1 FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        return row is not None


def update_title(session_id: str, title: str):
    """更新指定会话的标题。"""
    with sqlite3.connect(DB_PATH) as conn:
        updated = conn.execute(
            "UPDATE sessions SET title = ? WHERE session_id = ?",
            (title, session_id),
        )
        if updated.rowcount == 0:
            raise ValueError("会话不存在")
