import { CLIENT_ID } from "./constants.js";
import { createSequence } from "./sequence.js";

export function buildApiUrl({
  host,
  path,
  code,
  data,
  accessToken,
  clientId = CLIENT_ID,
  withoutToken = false,
  withClientId = false
}: any) {
  if (!code) {
    throw new TypeError("接口编码 code 必填。");
  }
  if (!path) {
    throw new TypeError("接口路径 path 必填。");
  }

  const url = new URL(path, normalizeHost(host));
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("seq", createSequence(code));
  if (withoutToken) {
    url.searchParams.set("client_id", clientId);
  } else {
    if (!accessToken) {
      throw new TypeError("accessToken 必填。");
    }
    url.searchParams.set("token", accessToken);
  }
  if (withClientId) {
    url.searchParams.set("client_id", clientId);
  }

  return url.toString();
}

export function buildOAuthRedirectUri({ host }) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    throw new TypeError("host 必填。");
  }

  const homeUrl = new URL("/home/", normalizedHost).toString();
  const loginRedirectUrl = new URL("/loginRedirect", normalizedHost);
  loginRedirectUrl.searchParams.set("redirectUrl", encodeURIComponent(homeUrl));

  const callbackUrl = new URL("https://weixin.towngasvcc.com/vcc-openapi/uv1/sys/outhCallBack");
  callbackUrl.searchParams.set("redirect_url", loginRedirectUrl.toString());
  return callbackUrl.toString();
}

export function normalizeHost(host) {
  if (!host) {
    return undefined;
  }

  const trimmed = String(host).trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
