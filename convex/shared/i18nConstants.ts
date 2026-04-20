export const ISO_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ',
  'BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR',
  'IO','BN','BG','BF','BI','CV','KH','CM','CA','KY','CF','TD','CL','CN','CX','CC',
  'CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ','DK','DJ','DM','DO',
  'EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF',
  'GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY',
  'HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','JM',
  'JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY',
  'LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX',
  'FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI',
  'NE','NG','NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH',
  'PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC',
  'WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS',
  'SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK',
  'TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','UM','US','UY','UZ','VU',
  'VE','VN','VG','VI','WF','EH','YE','ZM','ZW',
])

export const SUPPORTED_LOCALE_CODES: ReadonlySet<string> = new Set([
  'en', 'zh-CN', 'zh-TW', 'th', 'fr', 'ko',
])

export const E164_REGEX = /^\+[1-9]\d{1,14}$/

export function isValidIsoCountryCode(code: unknown): code is string {
  if (typeof code !== 'string') return false
  return /^[A-Z]{2}$/.test(code) && ISO_COUNTRY_CODES.has(code)
}

export function isValidSupportedLocale(code: unknown): code is string {
  if (typeof code !== 'string') return false
  return SUPPORTED_LOCALE_CODES.has(code)
}

export function isE164Shape(phone: unknown): phone is string {
  if (typeof phone !== 'string') return false
  return E164_REGEX.test(phone)
}

export function normalizeChineseScript(code: string): string {
  if (code.startsWith('zh-Hans')) return 'zh-CN'
  if (code.startsWith('zh-Hant')) return 'zh-TW'
  return code
}
