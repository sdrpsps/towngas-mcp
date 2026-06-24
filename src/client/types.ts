export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface UnknownRecord {
  [key: string]: unknown;
}

/** MCP 工具统一附加的调试元数据，不包含 token。 */
export interface TowngasToolMeta {
  /** 实际请求的燃气公司服务地址。 */
  host?: string;
  /** 燃气公司机构编码。 */
  orgCode?: string;
  /** 户号/用户号。 */
  subsCode?: string;
  /** 工具完成时间，ISO 8601 字符串。 */
  fetchedAt: string;
  /** 当前 access token 的预计过期时间，ISO 8601 字符串。 */
  tokenExpiresAt?: string;
}

/** MCP 业务查询工具的统一返回包装。 */
export interface TowngasToolResult<T> {
  result: T;
  meta: TowngasToolMeta;
}

/** 港华业务接口常见响应外壳，实际字段会因地区和接口有差异。 */
export interface TowngasBusinessResponse<T = UnknownRecord> extends UnknownRecord {
  /** 业务结果码，通常 "0" 表示成功。 */
  resultCode?: string | number;
  /** 业务结果说明。 */
  resultMsg?: string;
  /** 响应细节说明。 */
  details?: string;
  /** 主数据列表。 */
  datas?: T[];
}

/** 登录用户绑定的户号。字段含义来自接口实测和网页版命名推测。 */
export interface TowngasBoundAccount extends UnknownRecord {
  /** 户号/用户号。 */
  subsCode?: string;
  /** 内部户号 ID。 */
  subsId?: string;
  /** 户名，属于敏感个人信息。 */
  name?: string;
  /** 绑定账户昵称。 */
  nickName?: string;
  /** 燃气公司机构编码。 */
  orgCode?: string;
  /** 燃气公司名称。 */
  orgName?: string;
  /** 是否默认户号的标记。 */
  defaultFlag?: string;
  /** 展示地址，属于敏感个人信息。 */
  displayAddr?: string;
  /** 户号状态。 */
  state?: string;
  /** 是否已实名或已校验的标记。 */
  isVerify?: string;
  /** 实名姓名，属于敏感个人信息。 */
  realName?: string;
  /** 证件号，属于敏感个人信息。 */
  certNum?: string;
  /** 合同或代扣相关标记。 */
  contractFlag?: string;
  /** 手机号，属于敏感个人信息。 */
  phoneNum?: string;
  /** 绑定方式。 */
  bindWay?: string;
  /** 银行或扣费账号，属于敏感个人信息。 */
  account?: string;
  /** 银行名称。 */
  bankName?: string;
  /** 银行编码。 */
  bankCode?: string;
  /** 脱敏后的银行或扣费账号。 */
  desAccount?: string;
  /** 可办理业务编码列表。 */
  bizCodes?: unknown[];
}

/** 账单阶梯计价明细。 */
export interface TowngasStepFeeResult extends UnknownRecord {
  /** 阶梯单价。 */
  price?: string | number;
  /** 当前阶梯应收金额。 */
  chrgSum?: string | number;
  /** 当前阶梯用气量。 */
  amount?: string | number;
  /** 本期抄表日期。 */
  recorddate?: string;
  /** 上期抄表日期。 */
  lastrecorddate?: string;
  /** 阶梯或价格序号。 */
  priceseq?: string;
  /** 初始化日期或计费起始日期。 */
  initdate?: string;
}

/** 历史账单记录。 */
export interface TowngasBill extends UnknownRecord {
  /** 账务或收费单编号。 */
  acctshCode?: string;
  /** 费用类型。 */
  feeType?: string;
  /** 账期年月。 */
  yrMonth?: string;
  /** 上期读数。 */
  lastReading?: number;
  /** 本期读数。 */
  currReading?: number;
  /** 用气量。 */
  amount?: number;
  /** 单价。 */
  price?: string | number;
  /** 应收金额。 */
  chrgSum?: number;
  /** 已缴金额。 */
  paidSum?: number;
  /** 未缴费用。 */
  unpaidFee?: number;
  /** 总未缴费用。 */
  totalUnpaidFee?: number;
  /** 滞纳金起算日期。 */
  lateFeeDate?: string;
  /** 已缴滞纳金。 */
  paidLateFee?: number;
  /** 未缴滞纳金。 */
  unpaidLateFee?: number;
  /** 阶梯计价明细。 */
  stepFeeResults?: TowngasStepFeeResult[];
}

/** 历史账单分页响应。 */
export interface TowngasBillsResponse extends TowngasBusinessResponse<TowngasBill> {
  /** 当前页码。 */
  pageIndex?: number;
  /** 每页数量。 */
  pageSize?: number;
  /** 总记录数。 */
  total?: number;
  /** 总页数。 */
  totalPage?: number;
}

/** 最近抄表或读数记录。 */
export interface TowngasLastReading extends UnknownRecord {
  /** 资源或表具资源编码。 */
  resCode?: string;
  /** 最近抄表日期。 */
  recordDate?: string;
  /** 最近读数或本期用量，具体口径需继续按地区验证。 */
  amount?: number;
  /** 表具编号。 */
  meterCode?: string;
}

/** 最近抄表或读数响应。 */
export interface TowngasLastReadingsResponse extends TowngasBusinessResponse<TowngasLastReading> {
  /** 响应或读数状态。 */
  status?: string;
}

/** checkRouters 返回的业务路由和余额信息。 */
export interface TowngasRouterResult extends UnknownRecord {
  /** 当前需缴金额或欠费金额。 */
  fee?: string | number;
  /** 费用类型。 */
  feeType?: string;
  /** 预存款余额或账户余额。 */
  savingSum?: string | number;
  /** 业务编号。 */
  bizId?: string;
  /** 是否允许缴费/收费的标记。 */
  chargeFlag?: string;
  /** 路由或业务项列表，当前实测可能为空数组。 */
  datas?: unknown[];
  /** 内部户号 ID。 */
  subsId?: string;
  /** 户号/用户号。 */
  subsCode?: string;
  /** 燃气公司机构编码。 */
  orgCode?: string;
  /** 户名，属于敏感个人信息。 */
  subsName?: string;
  /** 展示地址，属于敏感个人信息。 */
  displayAddr?: string;
  /** 气费列表，实测为字符串，可能是空串或 JSON 字符串。 */
  gasFeeList?: string;
  /** 业务费列表，实测为字符串，可能是空串或 JSON 字符串。 */
  bizFeeList?: string;
}

/** MCP 工具名到 structuredContent 返回结构的映射。 */
export interface TowngasMcpToolOutputMap {
  towngas_get_bound_accounts: TowngasToolResult<TowngasBusinessResponse<TowngasBoundAccount>>;
  towngas_get_bills: TowngasToolResult<TowngasBillsResponse>;
  towngas_get_last_readings: TowngasToolResult<TowngasLastReadingsResponse>;
  towngas_check_routers: TowngasToolResult<TowngasRouterResult>;
}

export type TowngasMcpToolName = keyof TowngasMcpToolOutputMap;
export type TowngasMcpToolOutput = TowngasMcpToolOutputMap[TowngasMcpToolName];
