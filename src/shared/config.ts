import { TowngasClient } from "../client/towngas-client.js";
import { loadDotEnv } from "./dotenv.js";

export const TOWNGAS_ENV_KEYS = {
  host: "TOWNGAS_HOST",
  orgCode: "TOWNGAS_ORG_CODE",
  subsCode: "TOWNGAS_SUBS_CODE",
  accessToken: "TOWNGAS_ACCESS_TOKEN",
  refreshToken: "TOWNGAS_REFRESH_TOKEN",
};

export async function resolveTowngasConfig(options: any = {}, context: any = {}) {
  const env = context.env ?? process.env;
  if (context.loadDotEnv ?? context.env === undefined) {
    await loadDotEnv({
      env,
      cwd: context.cwd,
      filePath: context.envFile
    });
  }

  const orgCode = valueOrEnv(options.orgCode, env, TOWNGAS_ENV_KEYS.orgCode);

  return {
    host: valueOrEnv(options.host, env, TOWNGAS_ENV_KEYS.host),
    orgCode,
    subsCode: valueOrEnv(options.subsCode, env, TOWNGAS_ENV_KEYS.subsCode),
    accessToken: valueOrEnv(options.accessToken, env, TOWNGAS_ENV_KEYS.accessToken),
    accessTokenExpiresAt: options.accessTokenExpiresAt,
    refreshToken: valueOrEnv(options.refreshToken, env, TOWNGAS_ENV_KEYS.refreshToken)
  };
}

export async function createTowngasClient(options: any = {}, context: any = {}) {
  const { env = process.env, auth = false, request } = context;
  const config = await resolveTowngasConfig(options, context);

  if (!config.host) {
    throw new Error("需要 TOWNGAS_HOST。请传入 --host，或设置 TOWNGAS_HOST。");
  }

  // 需要登录的工具必须至少有一种 token 来源；优先推荐 refresh token。
  if (auth && !config.accessToken && !config.refreshToken) {
    throw new Error(
      "需要 access token 或 refresh token。请传入 --access-token/--refresh-token，或设置 TOWNGAS_ACCESS_TOKEN/TOWNGAS_REFRESH_TOKEN。"
    );
  }

  return new TowngasClient({
    ...config,
    request
  });
}

function valueOrEnv(value: any, env: any, key: any) {
  if (value !== undefined && value !== null && value !== "") {
    return value;
  }
  const envValue = env?.[key];
  return envValue === "" ? undefined : envValue;
}
