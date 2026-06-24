import { TowngasAuthError } from "../shared/errors.js";
import { BROWSER_HEADERS } from "./constants.js";
import { headerValue, jsonHeaders } from "./http-utils.js";
import { parseApiResponse } from "./responses.js";
import { buildApiUrl, normalizeHost } from "./urls.js";

export async function apiRequest(client: any, options: any) {
  const host = normalizeHost(options.host ?? client.host);
  if (!host) {
    throw new TypeError("服务地址 host 必填。");
  }

  const method = String(options.method ?? "GET").toUpperCase();
  let accessToken = options.accessToken ?? client.accessToken;
  const withoutToken = options.withoutToken ?? false;

  // 登录后接口统一在发请求前检查 access token，快过期或缺失时用 refresh token 换新。
  if (
    !withoutToken &&
    options.accessToken === undefined &&
    client.refreshToken &&
    !options.skipRefresh &&
    (!accessToken || client.shouldRefreshAccessToken())
  ) {
    await client.refreshAccessToken(client.refreshToken, {
      host,
      timeoutMs: options.timeoutMs
    });
    accessToken = client.accessToken;
  }

  const url = buildApiUrl({
    host,
    path: options.path,
    code: options.code,
    data: method === "GET" ? options.data : options.params,
    accessToken,
    clientId: options.clientId ?? client.clientId,
    withoutToken,
    withClientId: options.withClientId ?? false
  });

  const body = method === "GET" ? undefined : JSON.stringify(options.data ?? {});
  const headers: any = {
    ...BROWSER_HEADERS,
    Referer: `${host}/`,
    ...(body ? jsonHeaders() : {})
  };

  if (options.headToken) {
    const token = accessToken ?? client.accessToken;
    if (!token) {
      throw new TypeError("accessToken 必填。");
    }
    headers.Authorization = `bearer ${token}`;
  }

  const response = await client.request(url, {
    method,
    headers,
    body,
    timeoutMs: options.timeoutMs ?? client.directTimeoutMs,
    rejectUnauthorized: client.rejectUnauthorized
  });

  try {
    return parseApiResponse(response.status, headerValue(response.headers, "content-type"), response.text);
  } catch (error) {
    // 服务端返回登录态过期时只刷新并重试一次，避免无效 refresh token 导致死循环。
    if (error instanceof TowngasAuthError && !withoutToken && !options.skipRefresh && client.refreshToken) {
      await client.refreshAccessToken(client.refreshToken, {
        host,
        timeoutMs: options.timeoutMs
      });
      return apiRequest(client, {
        ...options,
        accessToken: client.accessToken,
        skipRefresh: true
      });
    }
    throw error;
  }
}
