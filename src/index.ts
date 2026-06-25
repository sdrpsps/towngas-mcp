export {
  BROWSER_HEADERS,
  TowngasClient,
  buildApiUrl,
  buildOAuthRedirectUri,
  calculateAccessTokenExpiresAt,
  createSequence,
  extractJsonText,
  extractPreText,
  extractTokenData,
  normalizeHost,
  parseApiResponse
} from "./client/index.js";

export {
  TowngasAuthError,
  TowngasApiError,
  TowngasError,
  TowngasParseError,
  TowngasRequestError,
  TowngasTimeoutError
} from "./shared/errors.js";

export {
  TOWNGAS_ENV_KEYS,
  createTowngasClient,
  resolveTowngasConfig
} from "./shared/config.js";

export {
  loadDotEnv
} from "./shared/dotenv.js";

export {
  TOWNGAS_TOOL_DEFINITIONS,
  createTowngasToolContext,
  executeTowngasTool,
  sanitizeToolResult
} from "./shared/tools.js";

export {
  createTowngasMcpServer,
  runTowngasMcpHttpServer,
  runTowngasMcpServer,
  toMcpToolResult
} from "./mcp/server.js";

export type {
  TowngasMcpHttpServer,
  TowngasMcpHttpServerOptions
} from "./mcp/server.js";

export type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
  TowngasBill,
  TowngasBillsResponse,
  TowngasBoundAccount,
  TowngasBusinessResponse,
  TowngasLastReading,
  TowngasLastReadingsResponse,
  TowngasMcpToolName,
  TowngasMcpToolOutput,
  TowngasMcpToolOutputMap,
  TowngasRouterResult,
  TowngasStepFeeResult,
  TowngasToolMeta,
  TowngasToolResult,
  UnknownRecord
} from "./client/index.js";
