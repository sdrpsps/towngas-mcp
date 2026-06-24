#!/usr/bin/env node
import {
  createTowngasClient
} from "../index.js";

const args: any = parseArgs(process.argv.slice(2));

try {
  // CLI 只负责解析输入和打印结果；实际请求逻辑复用 shared 层，避免和 MCP 分叉。
  const command = args._[0] ?? "help";

  if (command === "token") {
    await printToken(args);
  } else if (command === "user") {
    await printAuthenticated(args, (client) => client.getUserInfo());
  } else if (command === "accounts") {
    await printAuthenticated(args, (client) =>
      client.getBoundAccounts({ isPayOrReport: args["is-pay-or-report"] ?? args.isPayOrReport })
    );
  } else if (command === "bills") {
    await printAuthenticated(args, (client) =>
      client.getBills({
        pageIndex: numberArg(args["page-index"] ?? args.pageIndex, 1),
        pageSize: numberArg(args["page-size"] ?? args.pageSize, 10)
      })
    );
  } else if (command === "readings") {
    await printAuthenticated(args, (client) =>
      client.getLastReadings({
        meterCode: args["meter-code"] ?? args.meterCode
      })
    );
  } else if (command === "router") {
    await printAuthenticated(args, (client) =>
      client.checkRouters({
        scene: args.scene ?? "2003",
        meterCode: args["meter-code"] ?? args.meterCode,
        bizId: args["biz-id"] ?? args.bizId
      })
    );
  } else {
    printHelp();
  }
} catch (error) {
  process.exitCode = 1;
  console.error(error.stack ?? error.message);
}

async function printAuthenticated(args, callback) {
  const client = await createClient(args, { auth: true });
  const result = await callback(client);
  console.log(JSON.stringify(result, null, 2));
}

async function printToken(args) {
  const client = await createClient(args);
  const tokenCode = args["token-code"] ?? args.tokenCode;
  const refreshToken = args["refresh-token"] ?? args.refreshToken ?? process.env.TOWNGAS_REFRESH_TOKEN;

  if (tokenCode) {
    const result = await client.exchangeTokenCode(tokenCode, {
      redirectUri: args["redirect-uri"] ?? args.redirectUri
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!refreshToken) {
    throw new Error("需要 tokenCode 或 refresh token。请传入 --token-code、--refresh-token，或设置 TOWNGAS_REFRESH_TOKEN。");
  }

  const result = await client.refreshAccessToken(refreshToken);
  console.log(JSON.stringify(result, null, 2));
}

async function createClient(args, { auth = false } = {}) {
  const subsCode = args["subs-code"] ?? args.subsCode;
  const orgCode = args["org-code"] ?? args.orgCode;
  const accessToken = args["access-token"] ?? args.accessToken ?? process.env.TOWNGAS_ACCESS_TOKEN;
  const refreshToken = args["refresh-token"] ?? args.refreshToken ?? process.env.TOWNGAS_REFRESH_TOKEN;

  return createTowngasClient({
    subsCode,
    orgCode,
    host: args.host,
    accessToken,
    refreshToken
  }, {
    auth
  });
}

function numberArg(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`需要数字参数，实际收到: ${value}`);
  }
  return parsed;
}

function parseArgs(argv: any) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`用法:
  towngas token [--host <url>] --token-code <code> [--redirect-uri <url>]
  towngas token [--host <url>] [--refresh-token <token>]
  towngas user [--host <url>] [--access-token <token>|--refresh-token <token>]
  towngas accounts [--org-code <orgCode>] [--access-token <token>|--refresh-token <token>]
  towngas bills [--subs-code <userNo>] [--org-code <orgCode>] [--access-token <token>|--refresh-token <token>]
  towngas readings [--subs-code <userNo>] [--org-code <orgCode>] [--access-token <token>|--refresh-token <token>]
  towngas router [--subs-code <userNo>] [--org-code <orgCode>] [--access-token <token>|--refresh-token <token>]

选项:
  --host <url>               也可设置 TOWNGAS_HOST；必填
  --org-code <orgCode>       也可设置 TOWNGAS_ORG_CODE
  --subs-code <userNo>       也可设置 TOWNGAS_SUBS_CODE
  --access-token <token>     也可设置 TOWNGAS_ACCESS_TOKEN
  --refresh-token <token>    也可设置 TOWNGAS_REFRESH_TOKEN
  --token-code <code>        /home/?tokenCode=... 中的短时授权码
  --redirect-uri <url>       兑换 tokenCode 时覆盖 OAuth redirect_uri
  --page-index <number>      默认: 1
  --page-size <number>       默认: 10
  --meter-code <value>       抄表/路由查询可选表具编号

环境变量:
  也可以把下列变量写入当前工作目录的 .env 文件；真实环境变量优先于 .env。
  TOWNGAS_HOST               默认服务地址，例如 https://your-company.towngasvcc.com
  TOWNGAS_ORG_CODE           默认机构编码
  TOWNGAS_SUBS_CODE          默认户号/用户号
  TOWNGAS_REFRESH_TOKEN      推荐的登录凭据来源，access token 会自动刷新
  TOWNGAS_ACCESS_TOKEN       可选；短期 access token
`);
}
