import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server as HttpServer } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  TOWNGAS_TOOL_DEFINITIONS,
  createTowngasToolContext
} from "../shared/tools.js";
import type { TowngasMcpToolName } from "../client/types.js";
import { TOOL_OUTPUT_SCHEMAS } from "./schemas.js";

const optionalString = z.string().min(1).optional();
const accountArgs = {
  host: optionalString.describe("港华燃气公司服务地址；默认读取 TOWNGAS_HOST。"),
  orgCode: optionalString.describe("港华燃气机构编码；默认读取 TOWNGAS_ORG_CODE。"),
  subsCode: optionalString.describe("港华燃气户号/用户号；默认读取 TOWNGAS_SUBS_CODE。")
};

const TOOL_SCHEMAS: any = {
  towngas_get_bound_accounts: {
    isPayOrReport: optionalString.describe("可选前端标记；客户端默认使用 Y。")
  },
  towngas_get_bills: {
    ...accountArgs,
    pageIndex: z.number().int().positive().optional().describe("分页页码；默认 1。"),
    pageSize: z.number().int().positive().max(100).optional().describe("每页数量；默认 10。")
  },
  towngas_get_last_readings: {
    ...accountArgs,
    meterCode: optionalString.describe("可选表具编号。")
  },
  towngas_check_routers: {
    ...accountArgs,
    scene: optionalString.describe("业务场景；默认 2003。"),
    meterCode: optionalString.describe("可选表具编号。"),
    bizId: optionalString.describe("可选业务编号。")
  }
};

export function createTowngasMcpServer(options: any = {}) {
  const server = new McpServer({
    name: "towngas-client",
    version: options.version ?? getPackageVersion()
  });
  // MCP 层只做参数校验和结果包装，真实协议细节全部交给共享工具层和客户端。
  const context = createTowngasToolContext(options);

  for (const definition of TOWNGAS_TOOL_DEFINITIONS) {
    const toolName = definition.name as TowngasMcpToolName;
    server.registerTool(
      definition.name,
      {
        title: definition.name,
        description: definition.description,
        inputSchema: TOOL_SCHEMAS[definition.name] ?? {},
        outputSchema: TOOL_OUTPUT_SCHEMAS[definition.name],
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true
        }
      },
      async (args) => toMcpToolResult(await context.execute(toolName, args)) as any
    );
  }

  return server;
}

function getPackageVersion() {
  const packageJsonUrls = [
    new URL("../../../package.json", import.meta.url),
    new URL("../../package.json", import.meta.url)
  ];

  for (const packageJsonUrl of packageJsonUrls) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
      return packageJson.version ?? "0.0.0";
    } catch {
      // 普通构建和 Docker bundle 的相对路径不同，继续尝试下一个候选路径。
    }
  }

  return "0.0.0";
}

export interface TowngasMcpHttpServerOptions {
  listenHost?: string;
  port?: number;
  path?: string;
  version?: string;
  [key: string]: unknown;
}

export interface TowngasMcpHttpServer {
  server: HttpServer;
  url: string;
  close: () => Promise<void>;
}

interface HttpMcpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

export async function runTowngasMcpHttpServer(
  options: TowngasMcpHttpServerOptions = {}
): Promise<TowngasMcpHttpServer> {
  const listenHost = options.listenHost ?? "127.0.0.1";
  const port = options.port ?? 3000;
  const mcpPath = normalizeMcpPath(options.path ?? "/mcp");
  const sessions = new Map<string, HttpMcpSession>();

  const httpServer = createServer(async (request, response) => {
    try {
      await handleMcpHttpRequest({
        request,
        response,
        options,
        mcpPath,
        sessions
      });
    } catch (error) {
      writeJsonRpcError(response, 500, -32603, "Internal server error");
      console.error(error.stack ?? error.message);
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, listenHost, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;
  const urlHost = listenHost === "0.0.0.0" ? "localhost" : listenHost;
  const url = `http://${urlHost}:${resolvedPort}${mcpPath}`;

  return {
    server: httpServer,
    url,
    close: async () => {
      for (const session of Array.from(sessions.values())) {
        await session.server.close();
        await session.transport.close();
      }
      sessions.clear();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

export async function runTowngasMcpServer(options: TowngasMcpHttpServerOptions = {}) {
  return runTowngasMcpHttpServer(options);
}

async function handleMcpHttpRequest({
  request,
  response,
  options,
  mcpPath,
  sessions
}: {
  request: IncomingMessage;
  response: ServerResponse;
  options: TowngasMcpHttpServerOptions;
  mcpPath: string;
  sessions: Map<string, HttpMcpSession>;
}) {
  const requestPath = new URL(request.url ?? "/", "http://localhost").pathname;

  if (request.method === "GET" && requestPath === "/health") {
    writeJson(response, 200, { ok: true });
    return;
  }

  if (requestPath !== mcpPath) {
    writeText(response, 404, "Not found");
    return;
  }

  if (request.method === "OPTIONS") {
    writeCorsPreflight(response);
    return;
  }

  const sessionId = getHeader(request, "mcp-session-id");

  if (request.method === "POST") {
    const body = await readJsonBody(request).catch(() => {
      writeJsonRpcError(response, 400, -32700, "Parse error");
      return PARSE_ERROR;
    });

    if (body === PARSE_ERROR) {
      return;
    }

    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session && !sessionId && isInitializeBody(body)) {
      session = createHttpMcpSession(options, sessions);
      await session.server.connect(session.transport);
    }

    if (!session) {
      writeJsonRpcError(response, 400, -32000, "Bad Request: No valid session ID provided");
      return;
    }

    await session.transport.handleRequest(request, response, body);
    return;
  }

  if (request.method === "GET" || request.method === "DELETE") {
    const session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      writeJsonRpcError(response, 400, -32000, "Bad Request: No valid session ID provided");
      return;
    }

    await session.transport.handleRequest(request, response);
    return;
  }

  response.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
  writeJsonRpcError(response, 405, -32000, "Method not allowed");
}

const PARSE_ERROR = Symbol("parseError");

function createHttpMcpSession(
  options: TowngasMcpHttpServerOptions,
  sessions: Map<string, HttpMcpSession>
) {
  let session: HttpMcpSession;

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, session);
    },
    onsessionclosed: async (sessionId) => {
      sessions.delete(sessionId);
      await session.server.close();
    }
  });

  const server = createTowngasMcpServer(options);
  session = { transport, server };

  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      sessions.delete(sessionId);
    }
    server.close().catch((error) => console.error(error.stack ?? error.message));
  };

  return session;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text);
}

function isInitializeBody(body: unknown) {
  return Array.isArray(body) ? body.some(isInitializeRequest) : isInitializeRequest(body);
}

function normalizeMcpPath(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function getHeader(request: IncomingMessage, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function writeCorsPreflight(response: ServerResponse) {
  response.statusCode = 204;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, mcp-session-id, last-event-id"
  );
  response.end();
}

function writeJsonRpcError(
  response: ServerResponse,
  status: number,
  code: number,
  message: string
) {
  writeJson(response, status, {
    jsonrpc: "2.0",
    error: { code, message },
    id: null
  });
}

function writeJson(response: ServerResponse, status: number, value: unknown) {
  if (response.headersSent) {
    return;
  }
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(value));
}

function writeText(response: ServerResponse, status: number, value: string) {
  if (response.headersSent) {
    return;
  }
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain");
  response.end(value);
}

export function toMcpToolResult(value: any) {
  return {
    structuredContent: value,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
