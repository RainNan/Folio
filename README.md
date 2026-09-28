# Folio
Chat with documents using a question-answering system

## 启动后端及自动安装 LibreOffice

在已经安装项目 Python 依赖的环境中运行：

```bash
python start.py --host 0.0.0.0 --port 8000
```

启动器先检查 LibreOffice，再启动 Uvicorn。首次下载固定的 26.2.6 官方安装包并校验 SHA256；
后续启动复用可运行的安装，不重新下载。多个启动进程通过文件锁避免重复安装。

支持自动安装的系统：

| 系统 / 架构 | 默认目录 |
| --- | --- |
| Windows x86_64 | 项目目录 `.tools/libreoffice/26.2.6` |
| Ubuntu / Debian x86_64 | `/opt/libreoffice/26.2.6` |

Windows 使用 MSI 管理安装模式解包，不弹出安装界面；日志在安装目录的 `install.log`。
Linux 提取官方 DEB 的程序目录到指定位置，通过 apt 安装系统库和中文字体。
首次 Linux 安装需要网络和 sudo/root 权限，sudo 可能提示输入密码。
建议以普通应用用户运行启动器；仅安装依赖时调用 sudo。
无交互部署应事先由管理员准备目录权限、依赖并完成首次安装。
Linux 安装器需要支持 `tarfile.data_filter` 的 Python（例如 3.11.8+）。

可选环境变量（启动器从进程环境读取，不读取 `.env`）：

- `LIBREOFFICE_INSTALL_DIR`：自定义软件目录，其下按版本创建子目录。
- `LIBREOFFICE_PATH`：已有 `soffice` / `soffice.com` 的完整路径，设置后直接验证并复用，不自动安装。

ARM、macOS 和其他 Linux 发行版目前需手动安装并设置 `LIBREOFFICE_PATH`。
直接运行 `uvicorn app.api:app` 会绕过安装检查。
启动器通过环境变量 `LIBREOFFICE_PATH` 将路径传给后端；转换代码应从此变量读取可执行文件。
DOCX 上传后使用 LibreOffice 转换，生成的 PDF 保存在 `data/previews/<doc_id>.pdf`。
按 PDF 物理页提取文本，分块保留原 DOCX 文件名、`page_number`、`location` 和 `preview_url`。
上传响应及文档列表返回预览地址 `GET /documents/<doc_id>/preview`；可添加 `#page=8` 跳转到第 8 页。
页码以服务器保存的 PDF 为准，可能与其他字体环境下 Word 的分页不同。
重复上传复用索引和 PDF；旧版 DOCX 索引在重新上传时更新为按页索引。
删除文档同时删除索引及保存的 PDF。转换和首次入库失败不保留转换临时文件。

## 回答来源

`POST /chat` 返回 `{ "answer": "回答文本", "sources": [...] }`。
每个来源包含本次检索编号 `citation_id`、`doc_id`、`chunk_id`、`source`（文件名）、
`location`、可选 `page_number` / `preview_url`、检索片段 `excerpt` 和 `cited`。
`cited` 仅表示回答使用了对应编号，不代表系统已验证该资料能够支持结论。
回答上下文和来源列表共用一次检索的结果，文件名与页码由后端 metadata 提供。

来源随回答在同一 SQLite 事务中保存，`GET /messages` 也返回每条消息的 `sources`。
后端启动时自动为旧数据库补充该列；旧消息显示原回答，不补造历史来源。
前端兼容旧版纯字符串回答，在资料库和回答来源卡片中提供 PDF 预览、页码跳转及失效重试。
