import { expect, test, type Page } from "@playwright/test";
const id = "a".repeat(64);
const doc = { doc_id: id, filename: "项目说明.md", chunks: 12 };
// Never allow mocked tests to mutate the developer's actual backend.
test.beforeEach(async ({ page }) => {
  await page.route(/^http:\/\/[^/]+\/api\//, route => route.abort());
});
async function setup(page: Page, documents = [doc]) {
  await page.route("**/api/documents", (route) =>
    route.fulfill({ json: documents }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "让文档，成为答案。" }),
  ).toBeVisible();
}

test("shows actual document metadata and full ID", async ({ page }) => {
  await setup(page);
  await expect(page.getByText("12 个分块")).toBeVisible();
  await page.getByText("查看文档 ID").click();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});

test("upload uses file multipart field, refreshes list and reports duplicate", async ({
  page,
}) => {
  await setup(page, []);
  let uploaded = false;
  await page.route("**/api/documents", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().headers()["content-type"]).toContain(
        "multipart/form-data",
      );
      uploaded = true;
      await route.fulfill({
        json: {
          doc_id: id,
          status: "already_exists",
          chunks: 12,
          warnings: ["PDF 第 2 页未提取到文本"],
        },
      });
    } else await route.fulfill({ json: uploaded ? [doc] : [] });
  });
  await page
    .getByLabel("选择上传文档")
    .setInputFiles({
      name: "项目说明.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 内容"),
    });
  await expect(
    page.getByText("该文件已在资料库中", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("list").getByText("12 个分块")).toBeVisible();
});

test("invalid and oversized files are rejected before upload", async ({
  page,
}) => {
  await setup(page);
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
      name: "large.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
  await expect(page.getByRole("alert")).toContainText("10 MiB");
});

test("deletion requires confirmation and refreshes list", async ({ page }) => {
  await setup(page);
  let deleted = false;
  await page.route(`**/api/documents/${id}`, async (route) => {
    deleted = true;
    await route.fulfill({ json: { doc_id: id, status: "deleted" } });
  });
  await page.route("**/api/documents", (route) =>
    route.fulfill({ json: deleted ? [] : [doc] }),
  );
  await page.getByRole("button", { name: "删除 项目说明.md" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(deleted).toBe(false);
  await page.getByRole("button", { name: "保留文档" }).click();
  expect(deleted).toBe(false);
  await page.getByRole("button", { name: "删除 项目说明.md" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("给灵感一些依据")).toBeVisible();
});

test("chat sends question, prevents duplicates and renders string Markdown response", async ({
  page,
}) => {
  await setup(page);
  let count = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    count++;
    expect(route.request().postDataJSON()).toEqual({ question: "总结\n文档" });
    await gate;
    await route.fulfill({ json: "## 核心观点\n\n文档包含 **三个要点**。" });
  });
  const input = page.getByRole("textbox", { name: "输入你的问题" });
  await input.fill("总结");
  await input.press("Shift+Enter");
  await input.pressSequentially("文档");
  await input.press("Enter");
  await expect(page.getByText("正在查阅资料，整理答案…")).toBeVisible();
  await expect(page.getByRole("button", { name: "发送问题" })).toBeDisabled();
  await input.fill("重复提问");
  await input.press("Enter");
  expect(count).toBe(1);
  release();
  await expect(page.getByRole("heading", { name: "核心观点" })).toBeVisible();
});

test("model error shown inline, retry recovers", async ({ page }) => {
  await setup(page);
  let count = 0;
  await page.route("**/api/chat", (route) => {
    count++;
    return count === 1
      ? route.fulfill({ status: 502, json: "error" })
      : route.fulfill({ json: "重试成功" });
  });
  await page.getByRole("textbox").fill("解释文档");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(
    page.getByText("模型服务暂时不可用", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新提问" }).click();
  await expect(page.getByText("重试成功")).toBeVisible();
});

test("mobile drawer and layout fit screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole("button", { name: "打开资料库" }).click();
  await expect(
    page.getByRole("button", { name: "上传文档", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭资料库" }).last().click();
  await expect(page.getByRole("textbox")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true, animations: "disabled" });
});

test("network failure offers reconnect and server errors do not leak details", async ({
  page,
}) => {
  await page.route("**/api/documents", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("无法连接服务", { exact: false })).toBeVisible();
  await page.route("**/api/documents", (route) =>
    route.fulfill({ json: [doc] }),
  );
  await page.getByRole("button", { name: "重新连接" }).click();
  await expect(page.getByText("1 份文档可供检索")).toBeVisible();
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 500, json: { detail: "secret-internal-path" } }),
  );
  await page.getByRole("textbox").fill("问题");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.getByText("服务处理失败", { exact: false })).toBeVisible();
  await expect(page.getByText("secret-internal-path")).toHaveCount(0);
});
