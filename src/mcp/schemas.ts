import { z } from "zod";

const optionalString = z.string().optional();
const optionalNumber = z.number().optional();
const amountValue = z.union([z.string(), z.number()]).optional();

const metaSchema = z.object({
  host: optionalString.describe("实际请求的燃气公司服务地址。"),
  orgCode: optionalString.describe("燃气公司机构编码。"),
  subsCode: optionalString.describe("户号/用户号。"),
  fetchedAt: z.string().describe("工具完成时间，ISO 8601 字符串。"),
  tokenExpiresAt: optionalString.describe("当前 access token 的预计过期时间，ISO 8601 字符串。")
}).passthrough();

const boundAccountSchema = z.object({
  subsCode: optionalString.describe("户号/用户号。"),
  subsId: optionalString.describe("内部户号 ID。"),
  name: optionalString.describe("户名，属于敏感个人信息。"),
  nickName: optionalString.describe("绑定账户昵称。"),
  orgCode: optionalString.describe("燃气公司机构编码。"),
  orgName: optionalString.describe("燃气公司名称。"),
  defaultFlag: optionalString.describe("是否默认户号的标记。"),
  displayAddr: optionalString.describe("展示地址，属于敏感个人信息。"),
  state: optionalString.describe("户号状态。"),
  isVerify: optionalString.describe("是否已实名或已校验的标记。"),
  realName: optionalString.describe("实名姓名，属于敏感个人信息。"),
  certNum: optionalString.describe("证件号，属于敏感个人信息。"),
  contractFlag: optionalString.describe("合同或代扣相关标记。"),
  phoneNum: optionalString.describe("手机号，属于敏感个人信息。"),
  bindWay: optionalString.describe("绑定方式。"),
  account: optionalString.describe("银行或扣费账号，属于敏感个人信息。"),
  bankName: optionalString.describe("银行名称。"),
  bankCode: optionalString.describe("银行编码。"),
  desAccount: optionalString.describe("脱敏后的银行或扣费账号。"),
  bizCodes: z.array(z.unknown()).optional().describe("可办理业务编码列表。")
}).passthrough();

const businessResponseBase = {
  resultCode: z.union([z.string(), z.number()]).optional().describe("业务结果码，通常 0 表示成功。"),
  resultMsg: optionalString.describe("业务结果说明。"),
  details: optionalString.describe("响应细节说明。"),
  inPayTieOffFlag: optionalString.describe("可能是支付、销户或欠费停供相关状态标记。"),
  message_url: optionalString.describe("消息或通知 URL。")
};

const boundAccountsResultSchema = z.object({
  ...businessResponseBase,
  datas: z.array(boundAccountSchema).optional().describe("绑定户号列表。")
}).passthrough();

const stepFeeSchema = z.object({
  price: amountValue.describe("阶梯单价。"),
  chrgSum: amountValue.describe("当前阶梯应收金额。"),
  amount: amountValue.describe("当前阶梯用气量。"),
  recorddate: optionalString.describe("本期抄表日期。"),
  lastrecorddate: optionalString.describe("上期抄表日期。"),
  priceseq: optionalString.describe("阶梯或价格序号。"),
  initdate: optionalString.describe("初始化日期或计费起始日期。")
}).passthrough();

const billSchema = z.object({
  acctshCode: optionalString.describe("账务或收费单编号。"),
  feeType: optionalString.describe("费用类型。"),
  yrMonth: optionalString.describe("账期年月。"),
  lastReading: optionalNumber.describe("上期读数。"),
  currReading: optionalNumber.describe("本期读数。"),
  amount: optionalNumber.describe("用气量。"),
  price: amountValue.describe("单价。"),
  chrgSum: optionalNumber.describe("应收金额。"),
  paidSum: optionalNumber.describe("已缴金额。"),
  unpaidFee: optionalNumber.describe("未缴费用。"),
  totalUnpaidFee: optionalNumber.describe("总未缴费用。"),
  lateFeeDate: optionalString.describe("滞纳金起算日期。"),
  paidLateFee: optionalNumber.describe("已缴滞纳金。"),
  unpaidLateFee: optionalNumber.describe("未缴滞纳金。"),
  stepFeeResults: z.array(stepFeeSchema).optional().describe("阶梯计价明细。")
}).passthrough();

const billsResultSchema = z.object({
  ...businessResponseBase,
  pageIndex: optionalNumber.describe("当前页码。"),
  pageSize: optionalNumber.describe("每页数量。"),
  total: optionalNumber.describe("总记录数。"),
  totalPage: optionalNumber.describe("总页数。"),
  datas: z.array(billSchema).optional().describe("历史账单列表。")
}).passthrough();

const lastReadingSchema = z.object({
  resCode: optionalString.describe("资源或表具资源编码。"),
  recordDate: optionalString.describe("最近抄表日期。"),
  amount: optionalNumber.describe("最近读数或本期用量，具体口径需继续按地区验证。"),
  meterCode: optionalString.describe("表具编号。")
}).passthrough();

const lastReadingsResultSchema = z.object({
  ...businessResponseBase,
  status: optionalString.describe("响应或读数状态。"),
  datas: z.array(lastReadingSchema).optional().describe("最近抄表或读数列表。")
}).passthrough();

const routerResultSchema = z.object({
  fee: amountValue.describe("当前需缴金额或欠费金额。"),
  feeType: optionalString.describe("费用类型。"),
  savingSum: amountValue.describe("预存款余额或账户余额。"),
  bizId: optionalString.describe("业务编号。"),
  chargeFlag: optionalString.describe("是否允许缴费/收费的标记。"),
  datas: z.array(z.unknown()).optional().describe("路由或业务项列表，当前实测可能为空数组。"),
  subsId: optionalString.describe("内部户号 ID。"),
  subsCode: optionalString.describe("户号/用户号。"),
  orgCode: optionalString.describe("燃气公司机构编码。"),
  subsName: optionalString.describe("户名，属于敏感个人信息。"),
  displayAddr: optionalString.describe("展示地址，属于敏感个人信息。"),
  gasFeeList: optionalString.describe("气费列表，实测为字符串，可能是空串或 JSON 字符串。"),
  bizFeeList: optionalString.describe("业务费列表，实测为字符串，可能是空串或 JSON 字符串。")
}).passthrough();

function toolResultSchema<T extends z.ZodTypeAny>(result: T) {
  return z.object({
    result,
    meta: metaSchema
  }).passthrough();
}

export const TOOL_OUTPUT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  towngas_get_bound_accounts: toolResultSchema(boundAccountsResultSchema),
  towngas_get_bills: toolResultSchema(billsResultSchema),
  towngas_get_last_readings: toolResultSchema(lastReadingsResultSchema),
  towngas_check_routers: toolResultSchema(routerResultSchema)
};
