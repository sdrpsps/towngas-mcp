import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";

export async function loadDotEnv({
  cwd = process.cwd(),
  env = process.env,
  filePath = path.join(cwd, ".env")
}: any = {}) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const parsed = parse(text);
  for (const [key, value] of Object.entries(parsed)) {
    // 真实环境变量优先，.env 只负责补默认值，避免覆盖 shell/MCP client 注入的密钥。
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
  return parsed;
}
