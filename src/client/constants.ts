export const CLIENT_ID = "db196d62f7d211e8a9b2fa163e955d28";
export const DEFAULT_TOKEN_REFRESH_SKEW_MS = 60_000;

export const AUTH_EXPIRED_CODES = new Set(["40058", "20001"]);
export const CAPTCHA_ERROR_CODES = new Set(["40162", "40163"]);

export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "X-Requested-With": "XMLHttpRequest"
};
