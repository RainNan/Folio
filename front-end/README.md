# Folio · 基于文档的 AI 问答助手

React + Vite + TypeScript，使用原生 Fetch 统一封装请求。所有界面与交互代码位于本目录。

## 启动

后端使用项目原有 Python 环境，在项目根目录运行：

```powershell
python -m uvicorn app.api:app --host 127.0.0.1 --port 8000
```

`main.py` 是本地检索调试脚本，并非 Web 服务入口。后端依赖和模型密钥沿用根目录原有配置，不要将密钥放入任何 `VITE_` 环境变量。

另开终端运行：

```powershell
cd front-end
npm install
npm run dev
```

默认访问 http://127.0.0.1:5173。需要自定义时，将 `.env.example` 复制为 `.env.local` 并修改后重启 Vite：

```dotenv
VITE_API_BASE_URL=/api
API_PROXY_TARGET=http://127.0.0.1:8000
```

默认 `/api` 由 Vite 代理并移除前缀，例如 `/api/chat` 转发为后端 `/chat`。开发及 `npm run preview` 不需要修改后端 CORS。

## 构建与部署

```powershell
npm run build
npm run preview
```

构建产物在 `dist/`。生产环境部署时需要将 `/api/*` 反向代理到 FastAPI 并移除 `/api` 前缀，给上传及聊天至少 180 秒代理超时。Vite 配置不会被打包进静态资源；生产服务器必须自行配置代理。

也可以在构建前设置 `VITE_API_BASE_URL=http://127.0.0.1:8000`（生产环境替换为真实 HTTPS API 地址），但直接访问不同源需要后端增加 CORS 中间件。此项目未自动修改后端 CORS，配置示例：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)
```

生产配置使用实际前端站点来源。浏览器 HTTPS 页面不能直接调用 HTTP 后端。

## 实际 API 协议

| 操作     | 接口                         | 请求                      | 成功响应                             |
| -------- | ---------------------------- | ------------------------- | ------------------------------------ |
| 文档列表 | `GET /documents`             | 无                        | `[{doc_id, filename, chunks}]`       |
| 上传     | `POST /documents`            | multipart 表单字段 `file` | `{doc_id, status, chunks, warnings}` |
| 删除     | `DELETE /documents/{doc_id}` | SHA-256 文档 ID           | `{doc_id, status: "deleted"}`        |
| 问答     | `POST /chat`                 | JSON `{question: string}` | **JSON 字符串**                      |

上传状态为 `indexed` 或 `already_exists`。支持 TXT、MD、文本型 PDF、DOCX，单文件不超过 10 MiB；TXT/MD 需 UTF-8。扫描型 PDF 不会自动 OCR，解析警告会保留展示。拖放一次处理第一个文件。

后端仅做两处需求所必需的兼容补齐：

1. `app/api.py` 新增删除路由，复用已存在的 `delete_document`，并校验文档 ID。删除接口是幂等的。
2. `app/ingest.py` 的列表查询在已有 metadata 遍历中统计 `chunks`，保留 `doc_id` / `filename` 字段。前端兼容未返回 `chunks` 的旧列表。

现有上传、聊天、检索与模型配置保持不变。客户端处理 400、404、413、422、500、502、网络失败和 180 秒超时；不会将后端 500 原始异常中的内部路径或密钥直接展示。请求超时不代表服务端已停止执行。

## 会话边界

后端 `Service.history` 是服务进程内的全局共享历史，没有会话 ID、历史查询、重置或流式响应接口。因此前端仅保存当前页面消息，刷新页面不会重置服务端历史，不提供虚假的“新建独立会话”和来源引用。适用于当前单用户开发环境；多人使用需另行设计服务端会话隔离。文档操作不会清除历史消息，历史回答也不会因删除文档而改写。

## 目录

`src/api`：请求与错误封装；`src/hooks`：文档与聊天状态；`src/components`：资料库、上传、确认弹窗、聊天、消息及输入；`src/types`：后端协议与界面类型；`src/styles`：共享设计系统与响应式样式。

## 验证

```powershell
npx playwright install chromium
npm test
```

本机已安装 Chrome 时也可使用 PowerShell：`$env:PLAYWRIGHT_CHANNEL='chrome'; npm test`，无需下载 Chromium。

浏览器测试使用与后端代码一致的模拟 API，覆盖元数据、上传、重复文件、校验、删除确认、聊天请求、重复提交、Markdown、错误重试及移动端。真实模型结果依赖本机后端 Python 环境、API 配额和根目录模型配置，需要在后端启动后实测。
