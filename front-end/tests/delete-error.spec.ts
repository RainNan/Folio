import { expect, test } from '@playwright/test';

test('failed deletion stays in dialog and preserves document', async ({ page }) => {
  await page.route(/^http:\/\/[^/]+\/api\//, route => route.abort());
  await page.route('**/api/documents', route => route.fulfill({ json: [{ doc_id: 'a'.repeat(64), filename: '保留.md', chunks: 1 }] }));
  await page.route('**/api/documents/*', route => route.fulfill({ status: 500, json: { detail: 'internal error' } }));
  await page.goto('/');
  await page.getByRole('button', { name: '删除 保留.md' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('服务处理失败');
  await page.getByRole('button', { name: '保留文档' }).click();
  await expect(page.getByText('保留.md', { exact: true })).toBeVisible();
});
