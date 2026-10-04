import re

import jieba


def tokenize_zh(text: str) -> list[str]:
    text = text.lower()

    tokens = jieba.lcut(text)

    return [
        token.strip()
        for token in tokens
        if token.strip()
        and not re.fullmatch(r"\W+", token)
    ]


def tokenize_en(text: str):
    text = text.lower()
    tokens = re.findall(r"[a-zA-Z0-9]+", text)
    return tokens
