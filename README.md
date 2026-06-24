# 港华燃气 MCP Server

用于查询港华燃气登录后账户数据的 MCP server。CLI 主要用于本地调试和验证，TypeScript SDK 作为附带能力提供。

## 安装与构建

要求 Node.js 20 或更高版本。

```bash
pnpm install
pnpm run build
pnpm test
```

`src/` 是 TypeScript 源码；MCP server 和调试 CLI 的可执行入口由 `src/cli/` 编译到 `dist/src/cli/`。因此本地使用前需要先执行 `pnpm run build`。

构建流程使用 `esbuild` 生成 JavaScript，并用 TypeScript 生成 `.d.ts` 类型声明。

Docker 镜像使用 `pnpm run build:docker` 生成单文件 MCP bundle。运行层不包含 `node_modules`。

仓库内可以直接通过 pnpm 脚本启动 MCP server 或调试 CLI：

```bash
pnpm towngas:mcp
pnpm towngas user
pnpm towngas accounts
```

也可以把本仓库的命令链接到本机：

```bash
pnpm link --global
```

之后即可直接使用全局命令：

```bash
towngas user
towngas-mcp
```

## 配置

MCP server、调试 CLI 和附带 SDK 都支持从环境变量读取默认配置，也会通过 `dotenv` 自动读取当前工作目录的 `.env` 文件。用户需要自行提供 `access_token` 或 `refresh_token`，项目不会自动完成网页登录。

字段说明：

| 变量 | 必需 | 说明 |
|---|---:|---|
| `TOWNGAS_HOST` | 是 | 燃气公司服务地址，例如 `https://your-company.towngasvcc.com`。 |
| `TOWNGAS_ORG_CODE` | 是 | 燃气公司机构编码。 |
| `TOWNGAS_SUBS_CODE` | 是 | 默认户号/用户号。查询账单、读数和路由时会用到。 |
| `TOWNGAS_REFRESH_TOKEN` | 是 | 长期凭据来源。客户端会用它自动刷新 access token。 |
| `TOWNGAS_ACCESS_TOKEN` | 可选 | 短期 access token。缺失时会用 refresh token 刷新。 |

## MCP Server

启动 stdio MCP server：

```bash
towngas-mcp
```

也可以使用 Docker 镜像：

```bash
docker run --rm -i \
  -e TOWNGAS_HOST=https://your-company.towngasvcc.com \
  -e TOWNGAS_ORG_CODE=YOUR_ORG_CODE \
  -e TOWNGAS_SUBS_CODE=YOUR_SUBS_CODE \
  -e TOWNGAS_REFRESH_TOKEN=YOUR_REFRESH_TOKEN \
  -e TOWNGAS_ACCESS_TOKEN=YOUR_ACCESS_TOKEN \
  ghcr.io/sdrpsps/towngas-mcp:latest
```

MCP server 默认从环境变量或 `.env` 读取配置。MCP 工具不接受 token 参数，也不会在工具返回值中暴露 `access_token` 或 `refresh_token`。

当前 MCP 工具：

| 工具 | 说明 |
|---|---|
| `towngas_get_bound_accounts()` | 查询已绑定户号。 |
| `towngas_get_bills(subsCode?, orgCode?, host?, pageIndex?, pageSize?)` | 查询历史账单。 |
| `towngas_get_last_readings(subsCode?, orgCode?, host?, meterCode?)` | 查询最近抄表/读数。 |
| `towngas_check_routers(subsCode?, orgCode?, host?, scene?, meterCode?, bizId?)` | 查询网页版 `checkRouters` 路由/费用字段。 |

所有 MCP 工具都注册了 `outputSchema`。

登录后业务工具统一返回：

```json
{
  "result": {},
  "meta": {
    "host": "https://your-company.towngasvcc.com",
    "orgCode": "YOUR_ORG_CODE",
    "subsCode": "YOUR_SUBS_CODE",
    "fetchedAt": "2026-06-24T00:00:00.000Z",
    "tokenExpiresAt": "2026-06-24T00:15:00.000Z"
  }
}
```

字段口径来自实测响应和网页版命名推测。不同地区可能返回额外字段，schema 会保留这些字段。

## 调试 CLI

登录后查询：

```bash
towngas user
towngas accounts
towngas bills --page-index 1 --page-size 10
towngas readings
towngas router --scene 2003
```

也可以显式覆盖默认户号、机构编码或 host：

```bash
towngas bills \
  --host https://your-company.towngasvcc.com \
  --org-code YOUR_ORG_CODE \
  --subs-code YOUR_SUBS_CODE \
  --page-index 1 \
  --page-size 10
```

CLI 用于本地调试和验证 MCP 背后的接口能力，当前命令包括：

| 命令 | 说明 |
|---|---|
| `towngas user` | 查询当前登录用户信息。 |
| `towngas accounts` | 查询已绑定户号。 |
| `towngas bills` | 查询历史账单。 |
| `towngas readings` | 查询最近抄表/读数。 |
| `towngas router` | 调用登录后的 `checkRouters`。 |

常用参数：

| 参数 | 说明 |
|---|---|
| `--host <url>` | 覆盖服务地址。 |
| `--org-code <code>` | 覆盖机构编码。 |
| `--subs-code <code>` | 覆盖户号/用户号。 |
| `--access-token <token>` | 覆盖 access token。 |
| `--refresh-token <token>` | 覆盖 refresh token。 |
| `--page-index <number>` | 账单分页页码，默认 `1`。 |
| `--page-size <number>` | 账单每页数量，默认 `10`。 |
| `--meter-code <value>` | 读数/路由查询可选表具编号。 |
| `--biz-id <value>` | 路由查询可选业务编号。 |

## 附带 SDK

包的主要入口面向 MCP 使用；SDK 是附带能力，目前只承诺顶层入口和 MCP server 入口：

```ts
import { TowngasClient } from "towngas-client";
import { createTowngasMcpServer } from "towngas-client/mcp-server";
```

基础客户端示例：

```ts
import { TowngasClient } from "towngas-client";

const client = new TowngasClient({
  host: process.env.TOWNGAS_HOST,
  orgCode: process.env.TOWNGAS_ORG_CODE,
  subsCode: process.env.TOWNGAS_SUBS_CODE,
  refreshToken: process.env.TOWNGAS_REFRESH_TOKEN
});

const accounts = await client.getBoundAccounts();
const bills = await client.getBills({ pageIndex: 1, pageSize: 10 });
const readings = await client.getLastReadings();
const router = await client.checkRouters({ scene: "2003" });
```

已封装方法：

| 方法 | 说明 |
|---|---|
| `refreshAccessToken(refreshToken?, options?)` | 刷新 access token。 |
| `getUserInfo(options?)` | 查询当前登录用户。 |
| `getBoundAccounts(options?)` | 查询绑定户号。 |
| `getBills(options?)` | 查询账单。 |
| `getLastReadings(options?)` | 查询最近抄表/读数。 |
| `checkRouters(options?)` | 调用 `checkRouters`。 |
| `createWorksheet(data, options?)` | 创建工单，当前未暴露为 CLI/MCP 工具。 |
| `apiGet(code, path, data?, options?)` | 低层 GET 封装。 |
| `apiPost(code, path, data?, options?)` | 低层 POST 封装。 |

## 协议行为

- 登录后接口按网页版规则构造请求。
- 请求 URL 会附带 `seq`，格式为 `接口编码 + YYYYMMDDHHmmss + 13 位递增序号`。
- 登录后接口使用 `token=<access_token>`。
- `resultCode` 为 `0` 表示成功。
- `resultCode` 为 `40058` 或 `20001` 会触发一次 refresh token 刷新并重试。
- `resultCode` 为 `40162` 或 `40163` 会标记为验证码类错误。
- OAuth `invalid_grant` 会抛出 `TowngasAuthError`，通常表示 refresh token 已过期或被撤销。
