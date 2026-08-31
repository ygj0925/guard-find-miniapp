export interface AreaCodeItem {
  /** ISO 3166-1 alpha-2，列表唯一键（拨号码存在 +1、+7 等共用情况） */
  iso: string
  name: string
  enName: string
  /** 国际电话拨号码，不含 + */
  code: string
  letter: string
}

type RawAreaCode = [iso: string, name: string, enName: string, code: string]

const RAW_AREA_CODES: RawAreaCode[] = [
  ['AF', '阿富汗', 'Afghanistan', '93'],
  ['AL', '阿尔巴尼亚', 'Albania', '355'],
  ['DZ', '阿尔及利亚', 'Algeria', '213'],
  ['AS', '美属萨摩亚', 'American Samoa', '1684'],
  ['AD', '安道尔', 'Andorra', '376'],
  ['AO', '安哥拉', 'Angola', '244'],
  ['AI', '安圭拉', 'Anguilla', '1264'],
  ['AG', '安提瓜和巴布达', 'Antigua and Barbuda', '1268'],
  ['AR', '阿根廷', 'Argentina', '54'],
  ['AM', '亚美尼亚', 'Armenia', '374'],
  ['AW', '阿鲁巴', 'Aruba', '297'],
  ['AU', '澳大利亚', 'Australia', '61'],
  ['AT', '奥地利', 'Austria', '43'],
  ['AZ', '阿塞拜疆', 'Azerbaijan', '994'],
  ['BS', '巴哈马', 'Bahamas', '1242'],
  ['BH', '巴林', 'Bahrain', '973'],
  ['BD', '孟加拉国', 'Bangladesh', '880'],
  ['BB', '巴巴多斯', 'Barbados', '1246'],
  ['BY', '白俄罗斯', 'Belarus', '375'],
  ['BE', '比利时', 'Belgium', '32'],
  ['BZ', '伯利兹', 'Belize', '501'],
  ['BJ', '贝宁', 'Benin', '229'],
  ['BM', '百慕大', 'Bermuda', '1441'],
  ['BT', '不丹', 'Bhutan', '975'],
  ['BO', '玻利维亚', 'Bolivia', '591'],
  ['BA', '波斯尼亚和黑塞哥维那', 'Bosnia and Herzegovina', '387'],
  ['BW', '博茨瓦纳', 'Botswana', '267'],
  ['BR', '巴西', 'Brazil', '55'],
  ['VG', '英属维尔京群岛', 'British Virgin Islands', '1284'],
  ['BN', '文莱', 'Brunei', '673'],
  ['BG', '保加利亚', 'Bulgaria', '359'],
  ['BF', '布基纳法索', 'Burkina Faso', '226'],
  ['BI', '布隆迪', 'Burundi', '257'],
  ['KH', '柬埔寨', 'Cambodia', '855'],
  ['CM', '喀麦隆', 'Cameroon', '237'],
  ['CA', '加拿大', 'Canada', '1'],
  ['CV', '佛得角', 'Cape Verde', '238'],
  ['KY', '开曼群岛', 'Cayman Islands', '1345'],
  ['CF', '中非共和国', 'Central African Republic', '236'],
  ['TD', '乍得', 'Chad', '235'],
  ['CL', '智利', 'Chile', '56'],
  ['CN', '中国大陆', 'China', '86'],
  ['CO', '哥伦比亚', 'Colombia', '57'],
  ['KM', '科摩罗', 'Comoros', '269'],
  ['CG', '刚果（布）', 'Congo', '242'],
  ['CD', '刚果（金）', 'Congo (DRC)', '243'],
  ['CK', '库克群岛', 'Cook Islands', '682'],
  ['CR', '哥斯达黎加', 'Costa Rica', '506'],
  ['CI', '科特迪瓦', 'Cote d Ivoire', '225'],
  ['HR', '克罗地亚', 'Croatia', '385'],
  ['CU', '古巴', 'Cuba', '53'],
  ['CW', '库拉索', 'Curacao', '599'],
  ['CY', '塞浦路斯', 'Cyprus', '357'],
  ['CZ', '捷克', 'Czech Republic', '420'],
  ['DK', '丹麦', 'Denmark', '45'],
  ['DJ', '吉布提', 'Djibouti', '253'],
  ['DM', '多米尼克', 'Dominica', '1767'],
  ['DO', '多米尼加', 'Dominican Republic', '1809'],
  ['EC', '厄瓜多尔', 'Ecuador', '593'],
  ['EG', '埃及', 'Egypt', '20'],
  ['SV', '萨尔瓦多', 'El Salvador', '503'],
  ['GQ', '赤道几内亚', 'Equatorial Guinea', '240'],
  ['ER', '厄立特里亚', 'Eritrea', '291'],
  ['EE', '爱沙尼亚', 'Estonia', '372'],
  ['SZ', '斯威士兰', 'Eswatini', '268'],
  ['ET', '埃塞俄比亚', 'Ethiopia', '251'],
  ['FO', '法罗群岛', 'Faroe Islands', '298'],
  ['FJ', '斐济', 'Fiji', '679'],
  ['FI', '芬兰', 'Finland', '358'],
  ['FR', '法国', 'France', '33'],
  ['GF', '法属圭亚那', 'French Guiana', '594'],
  ['PF', '法属波利尼西亚', 'French Polynesia', '689'],
  ['GA', '加蓬', 'Gabon', '241'],
  ['GM', '冈比亚', 'Gambia', '220'],
  ['GE', '格鲁吉亚', 'Georgia', '995'],
  ['DE', '德国', 'Germany', '49'],
  ['GH', '加纳', 'Ghana', '233'],
  ['GI', '直布罗陀', 'Gibraltar', '350'],
  ['GR', '希腊', 'Greece', '30'],
  ['GL', '格陵兰', 'Greenland', '299'],
  ['GD', '格林纳达', 'Grenada', '1473'],
  ['GP', '瓜德罗普', 'Guadeloupe', '590'],
  ['GU', '关岛', 'Guam', '1671'],
  ['GT', '危地马拉', 'Guatemala', '502'],
  ['GN', '几内亚', 'Guinea', '224'],
  ['GW', '几内亚比绍', 'Guinea-Bissau', '245'],
  ['GY', '圭亚那', 'Guyana', '592'],
  ['HT', '海地', 'Haiti', '509'],
  ['HN', '洪都拉斯', 'Honduras', '504'],
  ['HK', '中国香港', 'Hong Kong', '852'],
  ['HU', '匈牙利', 'Hungary', '36'],
  ['IS', '冰岛', 'Iceland', '354'],
  ['IN', '印度', 'India', '91'],
  ['ID', '印度尼西亚', 'Indonesia', '62'],
  ['IR', '伊朗', 'Iran', '98'],
  ['IQ', '伊拉克', 'Iraq', '964'],
  ['IE', '爱尔兰', 'Ireland', '353'],
  ['IL', '以色列', 'Israel', '972'],
  ['IT', '意大利', 'Italy', '39'],
  ['JM', '牙买加', 'Jamaica', '1876'],
  ['JP', '日本', 'Japan', '81'],
  ['JO', '约旦', 'Jordan', '962'],
  ['KZ', '哈萨克斯坦', 'Kazakhstan', '7'],
  ['KE', '肯尼亚', 'Kenya', '254'],
  ['KI', '基里巴斯', 'Kiribati', '686'],
  ['KW', '科威特', 'Kuwait', '965'],
  ['KG', '吉尔吉斯斯坦', 'Kyrgyzstan', '996'],
  ['LA', '老挝', 'Laos', '856'],
  ['LV', '拉脱维亚', 'Latvia', '371'],
  ['LB', '黎巴嫩', 'Lebanon', '961'],
  ['LS', '莱索托', 'Lesotho', '266'],
  ['LR', '利比里亚', 'Liberia', '231'],
  ['LY', '利比亚', 'Libya', '218'],
  ['LI', '列支敦士登', 'Liechtenstein', '423'],
  ['LT', '立陶宛', 'Lithuania', '370'],
  ['LU', '卢森堡', 'Luxembourg', '352'],
  ['MO', '中国澳门', 'Macao', '853'],
  ['MG', '马达加斯加', 'Madagascar', '261'],
  ['MW', '马拉维', 'Malawi', '265'],
  ['MY', '马来西亚', 'Malaysia', '60'],
  ['MV', '马尔代夫', 'Maldives', '960'],
  ['ML', '马里', 'Mali', '223'],
  ['MT', '马耳他', 'Malta', '356'],
  ['MH', '马绍尔群岛', 'Marshall Islands', '692'],
  ['MQ', '马提尼克', 'Martinique', '596'],
  ['MR', '毛里塔尼亚', 'Mauritania', '222'],
  ['MU', '毛里求斯', 'Mauritius', '230'],
  ['MX', '墨西哥', 'Mexico', '52'],
  ['FM', '密克罗尼西亚', 'Micronesia', '691'],
  ['MD', '摩尔多瓦', 'Moldova', '373'],
  ['MC', '摩纳哥', 'Monaco', '377'],
  ['MN', '蒙古', 'Mongolia', '976'],
  ['ME', '黑山', 'Montenegro', '382'],
  ['MS', '蒙特塞拉特', 'Montserrat', '1664'],
  ['MA', '摩洛哥', 'Morocco', '212'],
  ['MZ', '莫桑比克', 'Mozambique', '258'],
  ['MM', '缅甸', 'Myanmar', '95'],
  ['NA', '纳米比亚', 'Namibia', '264'],
  ['NR', '瑙鲁', 'Nauru', '674'],
  ['NP', '尼泊尔', 'Nepal', '977'],
  ['NL', '荷兰', 'Netherlands', '31'],
  ['NC', '新喀里多尼亚', 'New Caledonia', '687'],
  ['NZ', '新西兰', 'New Zealand', '64'],
  ['NI', '尼加拉瓜', 'Nicaragua', '505'],
  ['NE', '尼日尔', 'Niger', '227'],
  ['NG', '尼日利亚', 'Nigeria', '234'],
  ['KP', '朝鲜', 'North Korea', '850'],
  ['MK', '北马其顿', 'North Macedonia', '389'],
  ['NO', '挪威', 'Norway', '47'],
  ['OM', '阿曼', 'Oman', '968'],
  ['PK', '巴基斯坦', 'Pakistan', '92'],
  ['PW', '帕劳', 'Palau', '680'],
  ['PS', '巴勒斯坦', 'Palestine', '970'],
  ['PA', '巴拿马', 'Panama', '507'],
  ['PG', '巴布亚新几内亚', 'Papua New Guinea', '675'],
  ['PY', '巴拉圭', 'Paraguay', '595'],
  ['PE', '秘鲁', 'Peru', '51'],
  ['PH', '菲律宾', 'Philippines', '63'],
  ['PL', '波兰', 'Poland', '48'],
  ['PT', '葡萄牙', 'Portugal', '351'],
  ['PR', '波多黎各', 'Puerto Rico', '1787'],
  ['QA', '卡塔尔', 'Qatar', '974'],
  ['RE', '留尼汪', 'Reunion', '262'],
  ['RO', '罗马尼亚', 'Romania', '40'],
  ['RU', '俄罗斯', 'Russia', '7'],
  ['RW', '卢旺达', 'Rwanda', '250'],
  ['KN', '圣基茨和尼维斯', 'Saint Kitts and Nevis', '1869'],
  ['LC', '圣卢西亚', 'Saint Lucia', '1758'],
  ['VC', '圣文森特和格林纳丁斯', 'Saint Vincent and the Grenadines', '1784'],
  ['WS', '萨摩亚', 'Samoa', '685'],
  ['SM', '圣马力诺', 'San Marino', '378'],
  ['ST', '圣多美和普林西比', 'Sao Tome and Principe', '239'],
  ['SA', '沙特阿拉伯', 'Saudi Arabia', '966'],
  ['SN', '塞内加尔', 'Senegal', '221'],
  ['RS', '塞尔维亚', 'Serbia', '381'],
  ['SC', '塞舌尔', 'Seychelles', '248'],
  ['SL', '塞拉利昂', 'Sierra Leone', '232'],
  ['SG', '新加坡', 'Singapore', '65'],
  ['SK', '斯洛伐克', 'Slovakia', '421'],
  ['SI', '斯洛文尼亚', 'Slovenia', '386'],
  ['SB', '所罗门群岛', 'Solomon Islands', '677'],
  ['SO', '索马里', 'Somalia', '252'],
  ['ZA', '南非', 'South Africa', '27'],
  ['KR', '韩国', 'South Korea', '82'],
  ['SS', '南苏丹', 'South Sudan', '211'],
  ['ES', '西班牙', 'Spain', '34'],
  ['LK', '斯里兰卡', 'Sri Lanka', '94'],
  ['SD', '苏丹', 'Sudan', '249'],
  ['SR', '苏里南', 'Suriname', '597'],
  ['SE', '瑞典', 'Sweden', '46'],
  ['CH', '瑞士', 'Switzerland', '41'],
  ['SY', '叙利亚', 'Syria', '963'],
  ['TW', '中国台湾', 'Taiwan', '886'],
  ['TJ', '塔吉克斯坦', 'Tajikistan', '992'],
  ['TZ', '坦桑尼亚', 'Tanzania', '255'],
  ['TH', '泰国', 'Thailand', '66'],
  ['TL', '东帝汶', 'Timor-Leste', '670'],
  ['TG', '多哥', 'Togo', '228'],
  ['TO', '汤加', 'Tonga', '676'],
  ['TT', '特立尼达和多巴哥', 'Trinidad and Tobago', '1868'],
  ['TN', '突尼斯', 'Tunisia', '216'],
  ['TR', '土耳其', 'Turkey', '90'],
  ['TM', '土库曼斯坦', 'Turkmenistan', '993'],
  ['TC', '特克斯和凯科斯群岛', 'Turks and Caicos Islands', '1649'],
  ['TV', '图瓦卢', 'Tuvalu', '688'],
  ['UG', '乌干达', 'Uganda', '256'],
  ['UA', '乌克兰', 'Ukraine', '380'],
  ['AE', '阿联酋', 'United Arab Emirates', '971'],
  ['GB', '英国', 'United Kingdom', '44'],
  ['US', '美国', 'United States', '1'],
  ['UY', '乌拉圭', 'Uruguay', '598'],
  ['UZ', '乌兹别克斯坦', 'Uzbekistan', '998'],
  ['VU', '瓦努阿图', 'Vanuatu', '678'],
  ['VA', '梵蒂冈', 'Vatican City', '379'],
  ['VE', '委内瑞拉', 'Venezuela', '58'],
  ['VN', '越南', 'Vietnam', '84'],
  ['YE', '也门', 'Yemen', '967'],
  ['ZM', '赞比亚', 'Zambia', '260'],
  ['ZW', '津巴布韦', 'Zimbabwe', '263'],
]

export const AREA_CODES: AreaCodeItem[] = RAW_AREA_CODES.map(([iso, name, enName, code]) => ({
  iso,
  name,
  enName,
  code,
  letter: enName[0].toUpperCase(),
}))

export const DEFAULT_AREA_ISO = 'CN'

/** 常用地区，置顶展示 */
export const HOT_AREA_ISOS = ['CN', 'HK', 'MO', 'TW', 'SG', 'MY', 'JP', 'KR', 'US', 'AU', 'GB', 'CA']

const AREA_CODE_BY_ISO = new Map(AREA_CODES.map(item => [item.iso, item]))

export function getAreaByIso(iso: string): AreaCodeItem {
  return AREA_CODE_BY_ISO.get(iso) || AREA_CODE_BY_ISO.get(DEFAULT_AREA_ISO)!
}

export const HOT_AREA_CODES: AreaCodeItem[] = HOT_AREA_ISOS.map(getAreaByIso)

export interface AreaCodeGroup {
  letter: string
  items: AreaCodeItem[]
}

export function groupAreaCodes(items: AreaCodeItem[] = AREA_CODES): AreaCodeGroup[] {
  const groups = new Map<string, AreaCodeItem[]>()
  for (const item of items) {
    const bucket = groups.get(item.letter)
    if (bucket) {
      bucket.push(item)
    }
    else {
      groups.set(item.letter, [item])
    }
  }
  return [...groups.entries()]
    .map(([letter, groupItems]) => ({ letter, items: groupItems }))
    .sort((a, b) => a.letter.localeCompare(b.letter))
}

export function searchAreaCodes(keyword: string): AreaCodeItem[] {
  const trimmed = keyword.trim().replace(/^\+/, '')
  if (!trimmed) {
    return AREA_CODES
  }
  const lower = trimmed.toLowerCase()
  return AREA_CODES.filter(item =>
    item.name.includes(trimmed)
    || item.enName.toLowerCase().includes(lower)
    || item.code.startsWith(trimmed)
    || item.iso.toLowerCase() === lower,
  )
}
