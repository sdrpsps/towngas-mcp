import { TowngasAuthError } from "./errors.js";
import { createTowngasClient, resolveTowngasConfig } from "./config.js";
import type {
  TowngasMcpToolName,
  TowngasMcpToolOutput,
  TowngasMcpToolOutputMap
} from "../client/types.js";

export const TOWNGAS_TOOL_DEFINITIONS = [
  {
    name: "towngas_get_bound_accounts",
    description: "列出当前登录用户绑定的户号。",
    auth: true
  },
  {
    name: "towngas_get_bills",
    description: "查询指定户号的历史账单。",
    auth: true
  },
  {
    name: "towngas_get_last_readings",
    description: "查询指定户号的最近抄表读数。",
    auth: true
  },
  {
    name: "towngas_check_routers",
    description: "调用登录后的 checkRouters 接口，可指定场景、表具编号和业务编号。",
    auth: true
  }
];

const TOOL_DEFINITIONS_BY_NAME = new Map(TOWNGAS_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

export function createTowngasToolContext(options: any = {}) {
  let client: any;

  return {
    async execute<Name extends TowngasMcpToolName>(
      name: Name,
      args: any = {}
    ): Promise<TowngasMcpToolOutputMap[Name]> {
      const definition = getToolDefinition(name);
      // 登录后工具复用同一个客户端实例，让自动刷新的 access token 留在进程内。
      if (definition.auth && !client) {
        client = await createTowngasClient(options.clientOptions, {
          env: options.env,
          auth: true,
          cwd: options.cwd,
          loadDotEnv: options.loadDotEnv,
          request: options.request
        });
      }

      return executeTowngasTool(name, args, {
        ...options,
        client
      });
    },

    get client() {
      return client;
    }
  };
}

export function executeTowngasTool<Name extends TowngasMcpToolName>(
  name: Name,
  args?: any,
  options?: any
): Promise<TowngasMcpToolOutputMap[Name]>;
export function executeTowngasTool(
  name: TowngasMcpToolName | string,
  args?: any,
  options?: any
): Promise<TowngasMcpToolOutput>;
export async function executeTowngasTool(
  name: TowngasMcpToolName | string,
  args: any = {},
  options: any = {}
): Promise<any> {
  const definition = getToolDefinition(name);
  const env = options.env ?? process.env;
  const input = args ?? {};

  const client =
    options.client ??
    (await createTowngasClient(
      {
        ...options.clientOptions,
        host: input.host ?? options.clientOptions?.host,
        orgCode: input.orgCode ?? options.clientOptions?.orgCode,
        subsCode: input.subsCode ?? options.clientOptions?.subsCode
      },
      {
        env,
        auth: definition.auth,
        cwd: options.cwd,
        loadDotEnv: options.loadDotEnv,
        request: options.request
      }
    ));

  try {
    const result = await runClientTool(client, name, input);
    const payload = {
      result,
      meta: await buildToolMetadata(client, input, { env })
    };
    return sanitizeToolResult(payload);
  } catch (error) {
    if (error instanceof TowngasAuthError && error.details?.error === "invalid_grant") {
      error.message =
        "港华燃气 refresh token 无效或已过期。请提供新的 access token 和 refresh token。";
    }
    throw error;
  }
}

export function sanitizeToolResult(value: any) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeToolResult(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  const sanitized = {};
  for (const [key, item] of Object.entries(value)) {
    // MCP 返回值会进入客户端上下文，任何 token 字段都必须在这里统一移除。
    if (isTokenKey(key)) {
      continue;
    }
    sanitized[key] = sanitizeToolResult(item);
  }
  return sanitized;
}

function getToolDefinition(name: any) {
  const definition = TOOL_DEFINITIONS_BY_NAME.get(name);
  if (!definition) {
    throw new TypeError(`未知的港华燃气工具: ${name}`);
  }
  return definition;
}

async function runClientTool(client: any, name: any, input: any) {
  if (name === "towngas_get_bound_accounts") {
    return client.getBoundAccounts({
      isPayOrReport: input.isPayOrReport
    });
  }

  if (name === "towngas_get_bills") {
    return client.getBills({
      host: input.host,
      orgCode: input.orgCode,
      subsCode: input.subsCode,
      pageIndex: input.pageIndex,
      pageSize: input.pageSize
    });
  }

  if (name === "towngas_get_last_readings") {
    return client.getLastReadings({
      host: input.host,
      orgCode: input.orgCode,
      subsCode: input.subsCode,
      meterCode: input.meterCode
    });
  }

  if (name === "towngas_check_routers") {
    return client.checkRouters({
      host: input.host,
      orgCode: input.orgCode,
      subsCode: input.subsCode,
      scene: input.scene,
      meterCode: input.meterCode,
      bizId: input.bizId
    });
  }

  throw new TypeError(`未处理的港华燃气工具: ${name}`);
}

async function buildToolMetadata(client: any, input: any, { env }: any) {
  const resolved = await resolveTowngasConfig(
    {
      host: input.host ?? client.host,
      orgCode: input.orgCode ?? client.orgCode,
      subsCode: input.subsCode ?? client.subsCode
    },
    { env }
  );

  return {
    host: resolved.host,
    orgCode: resolved.orgCode,
    subsCode: resolved.subsCode,
    fetchedAt: new Date().toISOString(),
    tokenExpiresAt: client.accessTokenExpiresAt?.toISOString()
  };
}

function isTokenKey(key: any) {
  const normalized = key.toLowerCase().replaceAll("_", "");
  return normalized === "token" || normalized === "accesstoken" || normalized === "refreshtoken";
}
