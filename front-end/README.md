# Folio 文档工作台

React + Vite + TypeScript。左侧会话栏支持创建、搜索、切换会话；文档管理从右上角资料库打开。

## 本地运行

在项目根目录使用现有 Python 环境启动后端：

```powershell
python -m uvicorn app.api:app --host 127.0.0.1 --port 8000
```

在另一个终端：

```powershell
cd front-end
npm install
npm run dev
```

访问 http://127.0.0.1:5173。开发服务器把 /api 代理到 http://127.0.0.1:8000。
可以在 .env.local 设置 API_PROXY_TARGET 和 VITE_API_BASE_URL（默认 /api）。
模型密钥只放在后端，不能写进 VITE_ 环境变量。

## 会话行为

- GET /sessions：加载左侧会话列表。
- POST /sessions：新建会话；也可直接在空白页提问，前端先创建会话再发送问题。
- GET /messages?session_id=...：加载指定会话的历史，把 human/ai 转为界面中的 user/assistant。
- POST /chat：发送 JSON {session_id, question}，接收 JSON 字符串回答。
- 回答完成后刷新会话列表，显示后端生成的标题与顺序。
- 当前会话 ID 保存在 localStorage；消息从后端加载。草稿按会话暂存在页面内存，刷新后不保留。
- 请求结果与加载状态按会话 ID 存储。切换会话不会将上一会话的延迟回答或历史混入新会话。
- 同一页面内，同一会话发送期间禁止重复提交；不同会话可分别等待回答。这不替代服务端的多标签页并发控制。
- 历史加载失败时禁止继续发送，提供重新加载按钮。
- 请求超时不表示服务端停止执行；重试前应重新加载历史确认结果，后端目前没有请求幂等键。

文档仍通过 GET/POST /documents 和 DELETE /documents/{doc_id} 管理。所有会话共用资料库，删除资料不会改写已保存的历史回答。
上传支持 TXT、MD、文本型 PDF、DOCX，每份最多 10 MiB。拖放每次处理一个文件。

## 构建与验证

```powershell
npm run build
npx playwright install chromium
npm test
```

也可用本机 Edge：`$env:PLAYWRIGHT_CHANNEL='msedge'; npm test`。

测试使用模拟 API，不调用模型、不修改真实数据库。覆盖会话隔离、发送中切换、乱序历史响应、刷新恢复、草稿、创建失败、错误重试、文档操作和手机布局。

生产构建位于 dist/。部署时需要将 /api/* 反向代理到 FastAPI 并移除 /api 前缀，上传和聊天请求超时应不少于 180 秒。Vite 的开发代理配置不包含在静态产物中。
