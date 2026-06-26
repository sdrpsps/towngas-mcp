import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createTowngasMcpServer,
  createTowngasToolContext,
  resolveTowngasConfig,
  runTowngasMcpHttpServer,
  sanitizeToolResult,
  TOWNGAS_TOOL_DEFINITIONS,
  toMcpToolResult
} from "../src/index.js";

test("resolveTowngasConfig reads supported env fields", async () => {
  const config = await resolveTowngasConfig({}, {
    env: {
      TOWNGAS_HOST: "https://demo.towngasvcc.com",
      TOWNGAS_ORG_CODE: "ORG001",
      TOWNGAS_SUBS_CODE: "SUBS001",
      TOWNGAS_REFRESH_TOKEN: "refresh-secret"
    }
  });

  assert.equal(config.orgCode, "ORG001");
  assert.equal(config.subsCode, "SUBS001");
  assert.equal(config.host, "https://demo.towngasvcc.com");
  assert.equal(config.refreshToken, "refresh-secret");
});

test("resolveTowngasConfig can read defaults from .env without overriding env", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "towngas-env-"));
  try {
    await writeFile(
      path.join(tempDir, ".env"),
      [
        "TOWNGAS_HOST=https://demo.towngasvcc.com",
        "TOWNGAS_ORG_CODE=ORG001",
        "TOWNGAS_SUBS_CODE=SUBS001",
        "TOWNGAS_REFRESH_TOKEN=from-dotenv",
        "TOWNGAS_ACCESS_TOKEN=from-dotenv"
      ].join("\n")
    );

    const env: Record<string, string> = {
      TOWNGAS_ACCESS_TOKEN: "from-real-env"
    };
    const config = await resolveTowngasConfig({}, {
      env,
      cwd: tempDir,
      loadDotEnv: true
    });

    assert.equal(config.orgCode, "ORG001");
    assert.equal(config.subsCode, "SUBS001");
    assert.equal(config.host, "https://demo.towngasvcc.com");
    assert.equal(config.refreshToken, "from-dotenv");
    assert.equal(config.accessToken, "from-real-env");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("sanitizeToolResult removes token fields recursively", () => {
  assert.deepEqual(
    sanitizeToolResult({
      access_token: "access-secret",
      refreshToken: "refresh-secret",
      nested: {
        token: "token-secret",
        tokenExpiresAt: "2026-06-24T00:00:00.000Z",
        value: 1
      }
    }),
    {
      nested: {
        tokenExpiresAt: "2026-06-24T00:00:00.000Z",
        value: 1
      }
    }
  );
});

test("createTowngasToolContext reuses refreshed access token across MCP-style calls", async () => {
  const requests = [];
  const context = createTowngasToolContext({
    env: {
      TOWNGAS_HOST: "https://demo.towngasvcc.com",
      TOWNGAS_ORG_CODE: "ORG001",
      TOWNGAS_REFRESH_TOKEN: "refresh-old"
    },
    request: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);

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

  await context.execute("towngas_get_bound_accounts");
  await context.execute("towngas_get_bound_accounts");

  assert.equal(requests.length, 3);
  assert.equal(requests[0].pathname, "/openapi/uv1/oauth/token");
  assert.equal(requests[1].searchParams.get("token"), "access-new");
  assert.equal(requests[2].searchParams.get("token"), "access-new");
  assert.equal(context.client.refreshToken, "refresh-new");
});

test("toMcpToolResult returns structured content and text content", () => {
  const result = toMcpToolResult({ ok: true });
  assert.deepEqual(result.structuredContent, { ok: true });
  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /"ok": true/);
});

test("createTowngasMcpServer creates an MCP server instance", () => {
  const server = createTowngasMcpServer();
  assert.equal(server.isConnected(), false);
});

test("runTowngasMcpHttpServer starts a Streamable HTTP endpoint", async (t) => {
  let server;
  try {
    server = await runTowngasMcpHttpServer({
      listenHost: "127.0.0.1",
      port: 0
    });
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("sandbox does not allow opening a local listener");
      return;
    }
    throw error;
  }

  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);

    const response = await fetch(server.url.replace(/\/mcp$/, "/health"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    await server.close();
  }
});

test("runTowngasMcpHttpServer can close an initialized session without recursion", async (t) => {
  let server;
  try {
    server = await runTowngasMcpHttpServer({
      listenHost: "127.0.0.1",
      port: 0
    });
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("sandbox does not allow opening a local listener");
      return;
    }
    throw error;
  }

  const initializeResponse = await fetch(server.url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "towngas-test",
          version: "1.0.0"
        }
      }
    })
  });

  try {
    assert.equal(initializeResponse.status, 200);
    assert.ok(initializeResponse.headers.get("mcp-session-id"));
    await server.close();
  } finally {
    await initializeResponse.body?.cancel().catch(() => {});
  }
});

test("createTowngasMcpServer registers output schemas for every tool", () => {
  const server = createTowngasMcpServer();
  const registeredTools = (server as any)._registeredTools;

  for (const definition of TOWNGAS_TOOL_DEFINITIONS) {
    const tool =
      registeredTools instanceof Map
        ? registeredTools.get(definition.name)
        : registeredTools[definition.name];
    assert.ok(tool, `${definition.name} should be registered`);
    assert.ok(tool.outputSchema, `${definition.name} should have outputSchema`);
  }
});
