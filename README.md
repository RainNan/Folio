# Folio
根据上传的文档（md，txt，pdf，word）回答问题

## QuickStart
启动后端:
```bash
python start.py --host 127.0.0.1 --port 8000
```

启动前端：
```bash
cd front-end
npm run dev
```

## 回答来源

问答使用混合检索：向量与 BM25 各召回最多 10 个分块，经 RRF 融合后取前 4 个。
BM25 使用 jieba 分词，复用 Chroma 中已有分块和元数据，不需要重新生成 embedding。
后端启动时加载索引，通过 API 上传或删除文档后重建索引。
当前内存索引及读写锁适用于单个后端进程；请使用一个 Uvicorn worker。
从其他进程或脚本修改 Chroma 后，需要重启后端以刷新 BM25。
Python 环境需安装 `jieba` 和 `rank-bm25`。

`POST /chat` 返回 `{ "answer": "回答文本", "sources": [...] }`。
每个来源包含本次检索编号 `citation_id`、`doc_id`、`chunk_id`、`source`（文件名）、
`location`、可选 `page_number` / `preview_url`、检索片段 `excerpt` 和 `cited`。
`cited` 仅表示回答使用了对应编号，不代表系统已验证该资料能够支持结论。
回答上下文和来源列表共用一次检索的结果，文件名与页码由后端 metadata 提供。

来源随回答在同一 SQLite 事务中保存，`GET /messages` 也返回每条消息的 `sources`。
后端启动时自动为旧数据库补充该列；旧消息显示原回答，不补造历史来源。
前端兼容旧版纯字符串回答，在资料库和回答来源卡片中提供 PDF 预览、页码跳转及失效重试。
