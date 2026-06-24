import {
  AUTH_EXPIRED_CODES,
  CAPTCHA_ERROR_CODES
} from "./constants.js";
import {
  TowngasAuthError,
  TowngasApiError,
  TowngasParseError
} from "../shared/errors.js";

export function parseApiResponse(status, contentType, text) {
  if (Number(status) >= 400) {
    throw new TowngasApiError(`HTTP 状态码错误: ${status}`, { status });
  }

  const raw = parseJson(extractJsonText(text, contentType), "响应不是有效 JSON");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TowngasParseError("响应不是 JSON 对象", { type: typeof raw });
  }

  if (!Object.hasOwn(raw, "resultCode")) {
    return raw;
  }

  const resultCode = String(raw.resultCode);
  if (resultCode !== "0") {
    // 这两类 resultCode 表示登录态过期，交给上层刷新并重试。
    const message = raw.resultMsg ?? raw.message ?? "未知错误";
    const details = {
      resultCode: raw.resultCode,
      resultMsg: raw.resultMsg,
      captchaError: CAPTCHA_ERROR_CODES.has(resultCode)
    };

    if (AUTH_EXPIRED_CODES.has(resultCode)) {
      throw new TowngasAuthError(`登录态已过期: ${message}`, details);
    }

    throw new TowngasApiError(`API 错误: ${message}`, details);
  }

  return raw;
}

export function extractTokenData(response) {
  const candidates = [
    response?.data,
    Array.isArray(response?.datas) ? response.datas[0] : response?.datas,
    response
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      if (candidate.access_token || candidate.refresh_token) {
        return candidate;
      }
    }
  }

  return {};
}

export function calculateAccessTokenExpiresAt(expiresIn, now: any = Date.now()) {
  const seconds = Number(expiresIn);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  const baseTime = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(baseTime)) {
    return undefined;
  }

  return new Date(baseTime + seconds * 1000);
}

export function extractJsonText(text, contentType = "") {
  let candidate = String(text ?? "").trim();

  const preText = extractPreText(candidate);
  if (preText) {
    candidate = preText.trim();
  }

  if (candidate.startsWith("callback(") && candidate.endsWith(")")) {
    // 部分旧接口会返回 JSONP，这里只剥离 callback(...) 外壳。
    candidate = candidate.slice("callback(".length, -1).trim();
  }

  if (!String(contentType).toLowerCase().includes("json")) {
    const match = candidate.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      candidate = match[1].trim();
    }
  }

  return candidate;
}

export function extractPreText(text) {
  const match = String(text ?? "").match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  return match ? decodeHtmlEntities(match[1]).trim() : undefined;
}

export function parseJson(text, message) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new TowngasParseError(`${message}: ${error.message}`, {
      preview: String(text).slice(0, 300)
    });
  }
}

function decodeHtmlEntities(text) {
  return String(text)
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
