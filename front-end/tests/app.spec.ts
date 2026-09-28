import { expect, test, type Page } from "@playwright/test";
const doc = { doc_id: "a".repeat(64), filename: "项目说明.md", chunks: 12 };
type Row = { role: string; content: string };
async function setup(page: Page, populated = false) {
  const sessions = populated
    ? [
        { session_id: "a", title: "项目进度", updated_at: "1727000000" },
        { session_id: "b", title: "读书笔记", updated_at: "1726000000" },
      ]
    : [];
  const messages: Record<string, Row[]> = populated
    ? {
        a: [
          { role: "human", content: "A 的问题" },
          { role: "ai", content: "A 的回答" },
        ],
        b: [
          { role: "human", content: "B 的问题" },
          { role: "ai", content: "B 的回答" },
        ],
      }
    : {};
  let documents = [doc];
  let creates = 0;
  await page.route(/^http:\/\/[^/]+\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/sessions") {
      if (method === "POST") {
        const session = {
          session_id: "new-" + ++creates,
          title: "新对话",
          updated_at: String(Date.now() / 1000),
        };
        sessions.unshift(session);
        messages[session.session_id] = [];
        return route.fulfill({ json: session });
      }
      return route.fulfill({ json: sessions });
    }
    if (url.pathname === "/api/messages")
      return route.fulfill({
        json: messages[url.searchParams.get("session_id") || ""] || [],
      });
    if (url.pathname === "/api/chat") {
      const { session_id, question } = route.request().postDataJSON();
      expect(session_id).toBeTruthy();
      messages[session_id] = [
        ...(messages[session_id] || []),
        { role: "human", content: question },
        { role: "ai", content: "## 核心观点\n\n文档包含 **三个要点**。" },
      ];
      const session = sessions.find((s) => s.session_id === session_id);
      if (session) session.title = "文档核心观点";
      return route.fulfill({ json: "## 核心观点\n\n文档包含 **三个要点**。" });
    }
    if (url.pathname === "/api/documents") {
      if (method === "POST")
        return route.fulfill({
          json: {
            doc_id: doc.doc_id,
            status: "already_exists",
            chunks: 12,
            warnings: [],
          },
        });
      return route.fulfill({ json: documents });
    }
    if (
      url.pathname === "/api/documents/" + doc.doc_id &&
      method === "DELETE"
    ) {
      documents = [];
      return route.fulfill({ json: { doc_id: doc.doc_id, status: "deleted" } });
    }
    return route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "新建会话", exact: true }),
  ).toBeEnabled();
  return { sessions, messages };
}
const input = (page: Page) =>
  page.getByRole("textbox", { name: "输入你的问题" });
const select = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "历史会话" })
    .getByRole("button", { name, exact: true });
const openLibrary = (page: Page) =>
  page.getByRole("button", { name: /^资料库/ }).click();

test("creates session on first send, passes id, updates title and restores after refresh", async ({
  page,
}) => {
  await setup(page);
  await input(page).fill("总结文档");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(
    page.getByRole("heading", { name: "核心观点", exact: true }),
  ).toBeVisible();
  await expect(select(page, "文档核心观点")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "核心观点", exact: true }),
  ).toBeVisible();
  await expect(input(page)).toBeEmpty();
});

test("switches isolated histories and preserves each session draft", async ({
  page,
}) => {
  await setup(page, true);
  await expect(page.getByText("A 的回答", { exact: true })).toBeVisible();
  await input(page).fill("A 的草稿");
  await select(page, "读书笔记").click();
  await expect(page.getByText("B 的回答", { exact: true })).toBeVisible();
  await expect(page.getByText("A 的回答", { exact: true })).toHaveCount(0);
  await expect(input(page)).toBeEmpty();
  await select(page, "项目进度").click();
  await expect(input(page)).toHaveValue("A 的草稿");
});

test("late answer belongs to original session while switching and prevents duplicate sends", async ({
  page,
}) => {
  const state = await setup(page, true);
  await expect(page.getByText("A 的回答", { exact: true })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  await page.route("**/api/chat", async (route) => {
    count++;
    expect(route.request().postDataJSON()).toEqual({
      session_id: "a",
      question: "继续 A",
    });
    await gate;
    state.messages.a.push(
      { role: "human", content: "继续 A" },
      { role: "ai", content: "A 的延迟回答" },
    );
    await route.fulfill({ json: "A 的延迟回答" });
  });
  await input(page).fill("继续 A");
  await input(page).press("Enter");
  await expect(page.getByRole("button", { name: "发送问题" })).toBeDisabled();
  await select(page, "读书笔记").click();
  await expect(page.getByText("B 的回答", { exact: true })).toBeVisible();
  release();
  await expect(select(page, "项目进度").locator(".spin")).toHaveCount(0);
  await expect(page.getByText("A 的延迟回答", { exact: true })).toHaveCount(0);
  await select(page, "项目进度").click();
  await expect(page.getByText("A 的延迟回答", { exact: true })).toBeVisible();
  expect(count).toBe(1);
});

test("late history response cannot replace active session", async ({
  page,
}) => {
  await setup(page, true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/messages?session_id=b", async (route) => {
    await gate;
    await route.fulfill({ json: [{ role: "ai", content: "慢速 B" }] });
  });
  await select(page, "读书笔记").click();
  await expect(page.getByText("正在读取这个会话…")).toBeVisible();
  await select(page, "项目进度").click();
  await expect(page.getByText("A 的回答", { exact: true })).toBeVisible();
  release();
  await expect(page.getByText("慢速 B", { exact: true })).toHaveCount(0);
});

test("failed history loading blocks send and offers recovery", async ({
  page,
}) => {
  await setup(page, true);
  await page.route("**/api/messages?session_id=b", (route) =>
    route.fulfill({ status: 500, json: { detail: "secret-internal-path" } }),
  );
  await select(page, "读书笔记").click();
  await expect(page.getByRole("alert")).toContainText("服务处理失败");
  await expect(page.getByText("secret-internal-path")).toHaveCount(0);
  await input(page).fill("不能发送");
  await expect(page.getByRole("button", { name: "发送问题" })).toBeDisabled();
  await page.unroute("**/api/messages?session_id=b");
  await page.getByRole("button", { name: "重新加载历史" }).click();
  await expect(page.getByText("B 的回答", { exact: true })).toBeVisible();
});

test("create failure keeps draft and existing history", async ({ page }) => {
  await setup(page);
  await page.route("**/api/sessions", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: {} })
      : route.fallback(),
  );
  await input(page).fill("保留这个问题");
  await input(page).press("Enter");
  await expect(page.getByRole("alert")).toContainText("服务处理失败");
  await expect(input(page)).toHaveValue("保留这个问题");
});

test("model failure retries without duplicate local question", async ({
  page,
}) => {
  await setup(page, true);
  await expect(page.getByText("A 的回答", { exact: true })).toBeVisible();
  let count = 0;
  await page.route("**/api/chat", (route) =>
    ++count === 1
      ? route.fulfill({ status: 502, json: "error" })
      : route.fulfill({ json: "重试成功" }),
  );
  await input(page).fill("解释文档");
  await input(page).press("Enter");
  await expect(
    page.getByText("模型服务暂时不可用", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新提问" }).click();
  await expect(page.getByText("重试成功", { exact: true })).toBeVisible();
  await expect(page.getByText("解释文档", { exact: true })).toHaveCount(1);
});

test("document upload and delete remain available in library", async ({
  page,
}) => {
  await setup(page);
  await openLibrary(page);
  await expect(page.getByText("12 个分块")).toBeVisible();
  await page
    .getByLabel("选择上传文档")
    .setInputFiles({
      name: "bad.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("x"),
    });
  await expect(page.getByRole("alert")).toContainText("仅支持 TXT");
  await page
    .getByLabel("选择上传文档")
    .setInputFiles({
      name: "项目说明.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 内容"),
    });
  await expect(page.getByRole("status")).toContainText("无需重复上传");
  await page.getByRole("button", { name: "删除 项目说明.md" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText("给灵感一些依据")).toBeVisible();
});

test("new session, search and desktop layout", async ({ page }) => {
  await setup(page, true);
  await page.getByRole("button", { name: "新建会话", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "给你的文档，一个好问题。" }),
  ).toBeVisible();
  await expect(page.getByRole("log")).toHaveCount(0);
  await page.getByRole("textbox", { name: "搜索会话" }).fill("读书");
  await expect(select(page, "读书笔记")).toBeVisible();
  await expect(select(page, "项目进度")).toHaveCount(0);
  await page.getByRole("textbox", { name: "搜索会话" }).clear();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});

test("mobile navigation, library and layout fit screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Hidden desktop navigation is intentionally not used for setup on mobile.
  await page.route(/^http:\/\/[^/]+\/api\//, (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("documents") ? [doc] : [] });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "给你的文档，一个好问题。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "打开会话栏" }).click();
  await expect(page.getByRole("textbox", { name: "搜索会话" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("textbox", { name: "搜索会话" }),
  ).not.toBeVisible();
  await openLibrary(page);
  await expect(page.getByRole("heading", { name: "文档资料库" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
