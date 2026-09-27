const baseURL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(status: number, payload: unknown): string {
  const detail =
    typeof payload === "object" && payload !== null && "detail" in payload
      ? payload.detail
      : undefined;
  if (status === 413) return "文件太大了，单个文件不能超过 10 MiB。";
  if (status === 502)
    return "模型服务暂时不可用，请稍后重试，并检查后端模型服务配置。";
  // Do not expose raw backend 500 exceptions (may contain internal paths or secrets).
  if (status >= 500)
    return "服务处理失败，请稍后重试；若持续出现，请检查后端日志及模型服务。";
  if (status === 422)
    return "提交内容不符合要求，请检查文件或问题长度（最多 2000 字）。";
  if (status === 404) return "未找到对应资源或接口，请刷新并确认后端已更新。";
  if (typeof detail === "string" && detail.trim()) return detail;
  return status === 400
    ? "提交内容有误，请检查后重试。"
    : `请求失败（${status}），请稍后重试。`;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(`${baseURL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: unknown;
    try {
      payload = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      payload = null;
    }
    if (!response.ok)
      throw new ApiError(
        errorMessage(response.status, payload),
        response.status,
      );
    if (payload === null)
      throw new ApiError("服务返回了无法识别的数据，请检查 API 地址配置。", 0);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError(
        "请求超时，服务端可能仍在处理。请刷新文档列表或稍后重试。",
        0,
      );
    throw new ApiError(
      "无法连接服务，请确认后端已启动，并检查网络、API 地址及跨域配置。",
      0,
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : "发生未知错误，请重试。";
