import { readFileSync } from "node:fs";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

export async function runTowngasMcpServer(options: any = {}) {
  const server = createTowngasMcpServer(options);
  await server.connect(new StdioServerTransport());
  return server;
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
