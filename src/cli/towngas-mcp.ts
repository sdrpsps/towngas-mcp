#!/usr/bin/env node
import { runTowngasMcpHttpServer } from "../mcp/server.js";

try {
  const options = parseMcpCliArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
  } else {
    const server = await runTowngasMcpHttpServer({
      listenHost: options.listenHost,
      port: options.port,
      path: options.path
    });
    console.error(`Towngas MCP Streamable HTTP server listening at ${server.url}`);
  }
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}

interface McpCliOptions {
  help?: boolean;
  listenHost?: string;
  port?: number;
  path?: string;
}

export function parseMcpCliArgs(argv: string[]): McpCliOptions {
  const options: McpCliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--http") {
      // Streamable HTTP is the only supported MCP transport.
    } else if (arg === "--listen-host") {
      options.listenHost = readValue(argv, ++index, arg);
    } else if (arg === "--port") {
      options.port = parsePort(readValue(argv, ++index, arg));
    } else if (arg === "--path") {
      options.path = readValue(argv, ++index, arg);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }

  return options;
}

function readValue(argv: string[], index: number, flag: string) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} 需要一个值。`);
  }
  return value;
}

function parsePort(value: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("--port 必须是 0 到 65535 之间的整数。");
  }
  return port;
}

function printHelp() {
  console.log(`Usage: towngas-mcp [options]

Options:
  --http                          Accepted for compatibility; Streamable HTTP is always used
  --listen-host <host>            HTTP listen host, default 127.0.0.1
  --port <port>                   HTTP listen port, default 3000
  --path <path>                   HTTP MCP path, default /mcp
  -h, --help                      Show this help
`);
}
