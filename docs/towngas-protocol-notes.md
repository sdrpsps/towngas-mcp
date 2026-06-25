# Towngas Protocol Notes

This document keeps longer reverse-engineering notes out of `AGENTS.md`. Read it before changing endpoint behavior, auth, token refresh, response schemas, or MCP tool semantics.

## Frontend Request Shape

Authenticated web API calls follow the web frontend format:

- Base host is the selected company host, for example `https://your-company.towngasvcc.com`.
- Requests include a `seq` query parameter.
- `seq` shape:

```text
<5 digit interface code><YYYYMMDDHHmmss><13 digit increasing counter>
```

- Authenticated GET calls put parameters in the query string.
- Authenticated POST calls send JSON bodies.
- Authenticated calls use:

```text
token=<access_token>
```

- Unauthenticated OAuth/public calls use:

```text
client_id=db196d62f7d211e8a9b2fa163e955d28
```

## Login And OAuth Flow

The normal web login flow is:

1. User navigates to a protected page or login page.
2. Page embeds or redirects to:

```text
https://login.towngasvcc.com/oauth/authorize
```

with:

```text
client_id=db196d62f7d211e8a9b2fa163e955d28
scope=read write
response_type=code
redirect_uri=<encoded callback>
stdCode=<orgCode>
```

3. Login requires phone number, image captcha, SMS code, and sometimes Tencent slider captcha. Do not automate sensitive form submission unless the user explicitly asks and provides approval for that action.
4. After successful login, the browser reaches:

```text
https://your-company.towngasvcc.com/home/?tokenCode=<short-lived-code>
```

or an equivalent redirect path.

5. The frontend exchanges `tokenCode` through:

```text
GET /openapi/uv1/oauth/token
```

with:

```text
code=<tokenCode>
grant_type=authorization_code
scope=read write
redirect_uri=<same frontend callback shape>
client_id=db196d62f7d211e8a9b2fa163e955d28
seq=<code 1502 sequence>
```

6. The frontend stores the returned token object in browser `localStorage` under the `token` key:

```json
{
  "access_token": "...",
  "refresh_token": "..."
}
```

Do not inspect browser cookies or localStorage directly through Chrome automation. If token values are needed, ask the user to provide them or use a user-approved flow.

## Refresh Token Findings

The frontend code saves `refresh_token` but does not use it. When a normal web page sees `resultCode` `40058` or `20001`, it redirects to:

```text
/login?redirectUrl=<current page>
```

The OAuth service itself supports refresh grants. Verified behavior:

- Without `redirect_uri`, `/openapi/uv1/oauth/token` returned `redirect uri不能为空`.
- With `redirect_uri`, a fake refresh token returned `invalid_grant`.
- A real refresh response was verified to contain `access_token`, `token_type`, `refresh_token`, `expires_in`, and `scope`.

Working refresh request:

```text
GET /openapi/uv1/oauth/token
```

with:

```text
refresh_token=<refresh token>
grant_type=refresh_token
scope=read write
redirect_uri=<same frontend callback shape>
client_id=db196d62f7d211e8a9b2fa163e955d28
seq=<code 1502 sequence>
```

Observed response shape:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "refresh_token": "...",
  "expires_in": 899,
  "scope": "read write"
}
```

`TowngasClient` uses `expires_in` to set `client.accessTokenExpiresAt` and refreshes ahead of expiry.

## API Response Conventions

Business APIs usually return:

```json
{
  "resultCode": "0",
  "datas": []
}
```

or equivalent data fields.

Important error codes:

- `40058`: access token expired or unauthenticated.
- `20001`: auth expired or login required.
- `40162`, `40163`: captcha-related validation errors.

## Observed MCP And Client Return Shapes

TypeScript return types live in `src/client/types.ts`. MCP `outputSchema` definitions live in `src/mcp/schemas.ts`.

MCP uses Streamable HTTP and serves the MCP endpoint at `/mcp` by default. The CLI
listens on `127.0.0.1:3000` unless overridden; Docker images listen on
`0.0.0.0:3000`.

Business MCP tools return:

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

Tokens are not included in MCP responses.

### `towngas_get_bound_accounts` / `getBoundAccounts()`

Observed account fields:

- `subsCode`: 户号/用户号.
- `subsId`: 内部户号 ID.
- `name`, `realName`: 户名/实名; sensitive.
- `nickName`: 绑定账户昵称.
- `orgCode`, `orgName`: 燃气公司编码/名称.
- `defaultFlag`: 是否默认户号.
- `displayAddr`: 展示地址; sensitive.
- `state`: 户号状态.
- `isVerify`: 是否已实名/校验.
- `certNum`: 证件号; sensitive.
- `contractFlag`: 合同或代扣相关标记.
- `phoneNum`: 手机号; sensitive.
- `bindWay`: 绑定方式.
- `account`, `bankName`, `bankCode`, `desAccount`: 银行/扣费账户相关 fields; account values are sensitive.
- `bizCodes`: 可办理业务编码列表.
- Top-level `details`, `inPayTieOffFlag`, and `message_url` may also appear.

### `towngas_get_bills` / `getBills()`

Observed bill fields:

- Pagination: `pageIndex`, `pageSize`, `total`, `totalPage`.
- `datas[].acctshCode`: 账务/收费单编号.
- `datas[].feeType`: 费用类型.
- `datas[].yrMonth`: 账期年月.
- `datas[].lastReading`, `datas[].currReading`: 上期/本期读数.
- `datas[].amount`: 用气量.
- `datas[].price`: 单价.
- `datas[].chrgSum`: 应收金额.
- `datas[].paidSum`: 已缴金额.
- `datas[].unpaidFee`, `datas[].totalUnpaidFee`: 未缴费用.
- `datas[].lateFeeDate`: 滞纳金起算日期.
- `datas[].paidLateFee`, `datas[].unpaidLateFee`: 已缴/未缴滞纳金.
- `datas[].stepFeeResults[]`: 阶梯计价明细 with `price`, `chrgSum`, `amount`, `recorddate`, `lastrecorddate`, `priceseq`, and `initdate`.

### `towngas_get_last_readings` / `getLastReadings()`

Observed reading fields:

- `datas[].resCode`: 资源/表具资源编码.
- `datas[].recordDate`: 最近抄表日期.
- `datas[].amount`: probably latest reading amount or usage; exact business meaning still needs regional confirmation.
- `datas[].meterCode`: 表具编号.
- `status`: response/reading status.

### `towngas_check_routers` / `checkRouters()`

Observed fields:

- `fee`: 当前需缴金额/欠费.
- `feeType`: 费用类型.
- `savingSum`: 预存款余额.
- `bizId`: 业务编号.
- `chargeFlag`: 是否允许缴费/收费.
- `datas`: route/business items, currently observed as empty arrays.
- `subsId`, `subsCode`, `orgCode`, `subsName`, `displayAddr`: account/org/name/address fields; name and address are sensitive.
- `gasFeeList`, `bizFeeList`: observed as strings; may be empty strings or JSON strings.

`scene=2003` is the only verified scene. It appears to mean gas payment/account balance routing. Other scene values are unknown.

## Removed Capabilities

Do not restore these unless the user explicitly asks:

- `towngas_get_balance`
- `towngas_get_accounts_with_balance`
- `towngas_get_account_resources`
- `towngas_get_access_token`
- CLI `balance`, `accounts-balance`, `resources`, `access-token`
- public balance FlareSolverr fallback
- local token cache files such as `.towngas-token-cache.json`
- `data/orglist.json`, organization lookup CLI commands, and MCP organization lookup tools

## Future Codex Skill Notes

The future `towngas-mcp` skill should teach assistants:

- Required env/config fields: `TOWNGAS_HOST`, `TOWNGAS_ORG_CODE`, `TOWNGAS_SUBS_CODE`, `TOWNGAS_ACCESS_TOKEN`, `TOWNGAS_REFRESH_TOKEN`.
- Normal usage expects the user to provide `access_token` and `refresh_token`.
- Do not describe CLI token exchange in end-user README-style docs; tokenCode/OAuth details stay in protocol notes.
- Common intent mappings:
  - "查余额" -> `towngas_check_routers`.
  - "查绑定户号" -> `towngas_get_bound_accounts`.
  - "查历史账单" -> `towngas_get_bills`.
  - "查最近抄表/读数" -> `towngas_get_last_readings`.
- Never display tokens; treat account numbers, addresses, names, and phone numbers as sensitive.
