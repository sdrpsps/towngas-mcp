import assert from "node:assert/strict";
import test from "node:test";

import {
  TowngasAuthError,
  TowngasClient,
  buildApiUrl,
  buildOAuthRedirectUri,
  calculateAccessTokenExpiresAt,
  createSequence,
  extractJsonText,
  extractTokenData,
  normalizeHost,
  parseApiResponse
} from "../src/index.js";

test("normalizeHost adds https and removes trailing slashes", () => {
  assert.equal(normalizeHost("example.com/"), "https://example.com");
  assert.equal(normalizeHost("http://example.com///"), "http://example.com");
});

test("createSequence uses frontend-compatible shape", () => {
  const sequence = createSequence(1502, new Date("2026-06-24T09:10:41"));
  assert.equal(sequence.length, 32);
  assert.equal(sequence.startsWith("0150220260624091041"), true);
});

test("buildApiUrl appends token or client id", () => {
  const authed = new URL(
    buildApiUrl({
      host: "https://demo.towngasvcc.com",
      path: "/openapi/uv1/bill/queryBills",
      code: 3516,
      data: { subsCode: "SUBS001", orgCode: "ORG001" },
      accessToken: "token-1"
    })
  );

  assert.equal(authed.pathname, "/openapi/uv1/bill/queryBills");
  assert.equal(authed.searchParams.get("subsCode"), "SUBS001");
  assert.equal(authed.searchParams.get("orgCode"), "ORG001");
  assert.equal(authed.searchParams.get("token"), "token-1");
  assert.equal(authed.searchParams.get("seq")?.startsWith("03516"), true);

  const publicUrl = new URL(
    buildApiUrl({
      host: "https://demo.towngasvcc.com",
      path: "/openapi/uv1/org/queryOrgs",
      code: 3501,
      withoutToken: true
    })
  );

  assert.equal(publicUrl.searchParams.get("client_id"), "db196d62f7d211e8a9b2fa163e955d28");
  assert.equal(publicUrl.searchParams.has("token"), false);
});

test("buildOAuthRedirectUri matches frontend callback shape", () => {
  const redirectUri = new URL(buildOAuthRedirectUri({ host: "https://demo.towngasvcc.com" }));
  assert.equal(redirectUri.origin, "https://weixin.towngasvcc.com");
  assert.equal(redirectUri.pathname, "/vcc-openapi/uv1/sys/outhCallBack");
  assert.match(redirectUri.searchParams.get("redirect_url"), /^https:\/\/demo\.towngasvcc\.com\/loginRedirect/);
  assert.match(redirectUri.searchParams.get("redirect_url"), /redirectUrl=/);
});

test("calculateAccessTokenExpiresAt converts OAuth expires_in seconds", () => {
  assert.equal(
    calculateAccessTokenExpiresAt(899, new Date("2026-06-24T10:00:00.000Z")).toISOString(),
    "2026-06-24T10:14:59.000Z"
  );
  assert.equal(calculateAccessTokenExpiresAt("0"), undefined);
  assert.equal(calculateAccessTokenExpiresAt("not-a-number"), undefined);
});

test("parseApiResponse returns raw response and detects expired auth", () => {
  assert.deepEqual(
    parseApiResponse(200, "application/json", JSON.stringify({ resultCode: "0", datas: [{ id: 1 }] })),
    { resultCode: "0", datas: [{ id: 1 }] }
  );

  assert.throws(
    () => parseApiResponse(200, "application/json", JSON.stringify({ resultCode: "40058", resultMsg: "未登录" })),
    TowngasAuthError
  );
});

test("extractJsonText handles html pre blocks and jsonp", () => {
  assert.equal(
    extractJsonText("<html><body><pre>{&quot;data&quot;:{&quot;savingSum&quot;:1}}</pre></body></html>", "text/html"),
    '{"data":{"savingSum":1}}'
  );
  assert.equal(extractJsonText("callback({\"savingSum\":2})", "application/javascript"), '{"savingSum":2}');
});

test("extractTokenData handles top-level, data, and datas token payloads", () => {
  assert.equal(extractTokenData({ access_token: "access-1" }).access_token, "access-1");
  assert.equal(extractTokenData({ data: { refresh_token: "refresh-1" } }).refresh_token, "refresh-1");
  assert.equal(extractTokenData({ datas: [{ access_token: "access-2" }] }).access_token, "access-2");
});

test("TowngasClient getBills uses authenticated frontend API shape", async () => {
  const requests = [];
  const client = new TowngasClient({
    subsCode: "SUBS001",
    orgCode: "ORG001",
    host: "https://demo.towngasvcc.com",
    accessToken: "access-token-1",
    request: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          resultCode: "0",
          datas: [{ yrMonth: "202606", amount: "10" }]
        })
      };
    }
  });

  const result = await client.getBills({ pageIndex: 2, pageSize: 5 });
  const url = new URL(requests[0].url);

  assert.equal(result.datas[0].yrMonth, "202606");
  assert.equal(url.pathname, "/openapi/uv1/bill/queryBills");
  assert.equal(url.searchParams.get("token"), "access-token-1");
  assert.equal(url.searchParams.get("subsCode"), "SUBS001");
  assert.equal(url.searchParams.get("orgCode"), "ORG001");
  assert.equal(url.searchParams.get("pageIndex"), "2");
  assert.equal(url.searchParams.get("pageSize"), "5");
  assert.equal(url.searchParams.get("seq")?.startsWith("03516"), true);
  assert.equal(requests[0].options.method, "GET");
});

test("TowngasClient refreshAccessToken uses OAuth refresh grant and stores returned tokens", async () => {
  const requests = [];
  const client = new TowngasClient({
    host: "https://demo.towngasvcc.com",
    request: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          resultCode: "0",
          access_token: "access-new",
          refresh_token: "refresh-new",
          expires_in: 899,
          token_type: "bearer",
          scope: "read write"
        })
      };
    }
  });

  const result = await client.refreshAccessToken("refresh-old");
  const url = new URL(requests[0].url);

  assert.equal(result.access_token, "access-new");
  assert.equal(result.refresh_token, "refresh-new");
  assert.equal(result.token_type, "bearer");
  assert.equal(result.scope, "read write");
  assert.ok(result.access_token_expires_at instanceof Date);
  assert.equal(client.accessToken, "access-new");
  assert.equal(client.refreshToken, "refresh-new");
  assert.ok(client.accessTokenExpiresAt instanceof Date);
  assert.equal(url.pathname, "/openapi/uv1/oauth/token");
  assert.equal(url.searchParams.get("grant_type"), "refresh_token");
  assert.equal(url.searchParams.get("refresh_token"), "refresh-old");
  assert.match(url.searchParams.get("redirect_uri"), /^https:\/\/weixin\.towngasvcc\.com\/vcc-openapi\/uv1\/sys\/outhCallBack/);
  assert.equal(url.searchParams.get("client_id"), "db196d62f7d211e8a9b2fa163e955d28");
  assert.equal(url.searchParams.has("token"), false);
});

test("TowngasClient refreshAccessToken throws auth error for invalid OAuth grant", async () => {
  const client = new TowngasClient({
    host: "https://demo.towngasvcc.com",
    request: async () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      text: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid refresh token"
      })
    })
  });

  await assert.rejects(
    () => client.refreshAccessToken("refresh-old"),
    (error) =>
      error instanceof TowngasAuthError &&
      error.details.error === "invalid_grant" &&
      error.message.includes("Invalid refresh token")
  );
});

test("TowngasClient refreshes proactively when cached access token is near expiry", async () => {
  const requests = [];
  const client = new TowngasClient({
    orgCode: "ORG001",
    host: "https://demo.towngasvcc.com",
    accessToken: "access-old",
    refreshToken: "refresh-old",
    accessTokenExpiresAt: new Date(Date.now() + 30_000),
    tokenRefreshSkewMs: 60_000,
    request: async (url, options = {}) => {
      const parsedUrl = new URL(url);
      requests.push({ url: String(url), options });

      if (parsedUrl.pathname === "/openapi/uv1/oauth/token") {
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            access_token: "access-new",
            refresh_token: "refresh-new",
            expires_in: 899
          })
        };
      }

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          resultCode: "0",
          datas: [{ subsCode: "SUBS001" }]
        })
      };
    }
  });

  const result = await client.getBoundAccounts();
  const refreshUrl = new URL(requests[0].url);
  const apiUrl = new URL(requests[1].url);

  assert.equal(result.datas[0].subsCode, "SUBS001");
  assert.equal(requests.length, 2);
  assert.equal(refreshUrl.pathname, "/openapi/uv1/oauth/token");
  assert.equal(apiUrl.searchParams.get("token"), "access-new");
  assert.ok(client.accessTokenExpiresAt instanceof Date);
});

test("TowngasClient retries authenticated calls once after refreshing expired token", async () => {
  const requests = [];
  const client = new TowngasClient({
    orgCode: "ORG001",
    host: "https://demo.towngasvcc.com",
    accessToken: "access-old",
    refreshToken: "refresh-old",
    request: async (url, options = {}) => {
      const parsedUrl = new URL(url);
      requests.push({ url: String(url), options });

      if (parsedUrl.pathname === "/openapi/uv1/oauth/token") {
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            resultCode: "0",
            data: {
              access_token: "access-new",
              refresh_token: "refresh-new"
            }
          })
        };
      }

      if (parsedUrl.searchParams.get("token") === "access-old") {
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            resultCode: "40058",
            resultMsg: "access token 过期"
          })
        };
      }

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          resultCode: "0",
          datas: [{ subsCode: "SUBS001" }]
        })
      };
    }
  });

  const result = await client.getBoundAccounts();
  const refreshUrl = new URL(requests[1].url);
  const retryUrl = new URL(requests[2].url);

  assert.equal(result.datas[0].subsCode, "SUBS001");
  assert.equal(requests.length, 3);
  assert.equal(refreshUrl.pathname, "/openapi/uv1/oauth/token");
  assert.equal(refreshUrl.searchParams.get("grant_type"), "refresh_token");
  assert.match(refreshUrl.searchParams.get("redirect_uri"), /^https:\/\/weixin\.towngasvcc\.com\/vcc-openapi\/uv1\/sys\/outhCallBack/);
  assert.equal(retryUrl.pathname, "/openapi/uv1/user/queryBindSubsLimitServer");
  assert.equal(retryUrl.searchParams.get("token"), "access-new");
});
