import { requestText } from "../shared/http.js";
import {
  TowngasAuthError,
  TowngasApiError,
  TowngasParseError
} from "../shared/errors.js";
import {
  CLIENT_ID,
  DEFAULT_TOKEN_REFRESH_SKEW_MS
} from "./constants.js";
import {
  buildOAuthRedirectUri,
  normalizeHost
} from "./urls.js";
import {
  calculateAccessTokenExpiresAt,
  extractTokenData
} from "./responses.js";
import {
  normalizeExpiresAt
} from "./http-utils.js";
import { apiRequest } from "./api-request.js";
import type {
  TowngasBillsResponse,
  TowngasBoundAccount,
  TowngasBusinessResponse,
  TowngasLastReadingsResponse,
  TowngasRouterResult,
  UnknownRecord
} from "./types.js";

export class TowngasClient {
  [key: string]: any;

  constructor(options: any = {}) {
    // 客户端保存运行期状态；MCP/CLI 只提供 refresh token，access token 在这里自动刷新并缓存。
    this.subsCode = options.subsCode;
    this.orgCode = options.orgCode;
    this.host = options.host;
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.accessTokenExpiresAt = normalizeExpiresAt(options.accessTokenExpiresAt);
    this.tokenRefreshSkewMs = options.tokenRefreshSkewMs ?? DEFAULT_TOKEN_REFRESH_SKEW_MS;
    this.clientId = options.clientId ?? CLIENT_ID;
    this.directTimeoutMs = options.directTimeoutMs ?? 20_000;
    this.rejectUnauthorized = options.rejectUnauthorized ?? false;
    this.request = options.request ?? requestText;
  }

  setAccessToken(accessToken: any, options: any = {}) {
    this.accessToken = accessToken;
    if (Object.hasOwn(options, "expiresAt")) {
      this.accessTokenExpiresAt = normalizeExpiresAt(options.expiresAt);
    } else if (Object.hasOwn(options, "expiresIn")) {
      this.accessTokenExpiresAt = calculateAccessTokenExpiresAt(options.expiresIn, options.now);
    }
  }

  setRefreshToken(refreshToken: any) {
    this.refreshToken = refreshToken;
  }

  async exchangeTokenCode(tokenCode: any, options: any = {}): Promise<UnknownRecord> {
    if (!tokenCode) {
      throw new TypeError("tokenCode 必填。");
    }

    const host = normalizeHost(options.host ?? this.host);
    const redirectUri = options.redirectUri ?? buildOAuthRedirectUri({ host });
    // OAuth 接口属于免登录请求，需要 client_id，不带业务 token。
    const response = await this.apiGet(
      1502,
      "/openapi/uv1/oauth/token",
      {
        code: tokenCode,
        grant_type: "authorization_code",
        scope: options.scope ?? "read write",
        redirect_uri: redirectUri
      },
      {
        ...options,
        withoutToken: true,
        skipRefresh: true
      }
    );

    return this.#storeTokenResponse(response);
  }

  async refreshAccessToken(refreshToken = this.refreshToken, options: any = {}): Promise<UnknownRecord> {
    if (!refreshToken) {
      throw new TypeError("refreshToken 必填。");
    }

    const host = normalizeHost(options.host ?? this.host);
    const redirectUri = options.redirectUri ?? buildOAuthRedirectUri({ host });
    const response = await this.apiGet(
      1502,
      "/openapi/uv1/oauth/token",
      {
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: options.scope ?? "read write",
        redirect_uri: redirectUri
      },
      {
        ...options,
        withoutToken: true,
        skipRefresh: true
      }
    );

    return this.#storeTokenResponse(response);
  }

  async getUserInfo(options: any = {}): Promise<UnknownRecord> {
    return this.apiGet(1503, "/openapi/uv1/oauth/user/me", {}, options);
  }

  async getBoundAccounts(options: any = {}): Promise<TowngasBusinessResponse<TowngasBoundAccount>> {
    const { isPayOrReport = "Y", ...rest } = options;
    return this.apiGet(3529, "/openapi/uv1/user/queryBindSubsLimitServer", { isPayOrReport }, rest);
  }

  async getBills(options: any = {}): Promise<TowngasBillsResponse> {
    return this.apiGet(
      3516,
      "/openapi/uv1/bill/queryBills",
      {
        subsCode: options.subsCode ?? this.subsCode,
        orgCode: options.orgCode ?? this.orgCode,
        pageIndex: options.pageIndex ?? 1,
        pageSize: options.pageSize ?? 10,
        ...options.data
      },
      options
    );
  }

  async getLastReadings(options: any = {}): Promise<TowngasLastReadingsResponse> {
    return this.apiGet(
      3511,
      "/openapi/uv1/acct/queryLastReadings",
      {
        subsCode: options.subsCode ?? this.subsCode,
        orgCode: options.orgCode ?? this.orgCode,
        meterCode: options.meterCode ?? null,
        ...options.data
      },
      options
    );
  }

  async checkRouters(options: any = {}): Promise<TowngasRouterResult> {
    const data = {
      scene: options.scene ?? "2003",
      subsCode: options.subsCode ?? this.subsCode,
      orgCode: options.orgCode ?? this.orgCode,
      ...options.data
    };
    if (options.meterCode !== undefined) {
      data.meterCode = options.meterCode;
    }
    if (options.bizId !== undefined) {
      data.bizId = options.bizId;
    }

    return this.apiGet(4514, "/openapi/uv1/biz/checkRouters", data, options);
  }

  async createWorksheet(data: any, options: any = {}): Promise<UnknownRecord> {
    return this.apiPost(5501, "/openapi/uv1/worksheet/create", data, options);
  }

  async apiGet<T = UnknownRecord>(code: any, path: any, data: any = {}, options: any = {}): Promise<T> {
    // 保留公开 apiGet/apiPost，方便未来补充未封装的网页版接口。
    return apiRequest(this, {
      ...options,
      code,
      path,
      method: "GET",
      data
    });
  }

  async apiPost<T = UnknownRecord>(code: any, path: any, data: any = {}, options: any = {}): Promise<T> {
    return apiRequest(this, {
      ...options,
      code,
      path,
      method: "POST",
      data
    });
  }

  #storeTokenResponse(response: any) {
    // OAuth 返回形态不完全稳定，extractTokenData 会兼容顶层、data、datas 三种位置。
    if (response?.error) {
      const message = response.error_description ?? response.error;
      const details = {
        error: response.error,
        errorDescription: response.error_description
      };
      if (response.error === "invalid_grant") {
        throw new TowngasAuthError(`OAuth 错误: ${message}`, details);
      }
      throw new TowngasApiError(`OAuth 错误: ${message}`, details);
    }

    const tokenData = extractTokenData(response);
    if (!tokenData.access_token) {
      throw new TowngasParseError("OAuth 响应缺少 access_token", {
        keys: Object.keys(response ?? {})
      });
    }

    if (tokenData.access_token) {
      this.accessToken = tokenData.access_token;
    }
    if (tokenData.refresh_token) {
      this.refreshToken = tokenData.refresh_token;
    }
    if (tokenData.expires_in !== undefined) {
      this.accessTokenExpiresAt = calculateAccessTokenExpiresAt(tokenData.expires_in);
    }

    return {
      ...response,
      access_token: tokenData.access_token ?? response.access_token,
      refresh_token: tokenData.refresh_token ?? response.refresh_token,
      access_token_expires_at: this.accessTokenExpiresAt
    };
  }

  shouldRefreshAccessToken() {
    if (!this.accessTokenExpiresAt) {
      return false;
    }

    return this.accessTokenExpiresAt.getTime() - Date.now() <= this.tokenRefreshSkewMs;
  }
}
