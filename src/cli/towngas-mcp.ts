#!/usr/bin/env node
import { runTowngasMcpServer } from "../mcp/server.js";

try {
  await runTowngasMcpServer();
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
