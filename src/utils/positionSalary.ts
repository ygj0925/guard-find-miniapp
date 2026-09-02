export interface PositionSalary {
  salaryMin?: number
  salaryMax?: number
  salaryUnit?: string
}

const SALARY_PERIOD: Record<string, string> = {
  月薪: '/月',
  日薪: '/天',
  时薪: '/时',
  年薪: '/年',
}

function positiveAmount(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(maximumFractionDigits).replace(/\.0+$/, '')
}

function formatAmount(value: number, salaryUnit: string) {
  switch (salaryUnit) {
    case '月薪':
      return `${formatNumber(value / 1000)}K`
    case '年薪':
      return `${formatNumber(value / 10000)}万`
    case '日薪':
    case '时薪':
      return `¥${formatNumber(value, 2)}`
    default:
      return value >= 1000 ? `${formatNumber(value / 1000)}K` : `¥${formatNumber(value, 2)}`
  }
}

export function formatPositionSalary(position: PositionSalary) {
  const salaryUnit = position.salaryUnit?.trim() || ''
  const salaryMin = positiveAmount(position.salaryMin)
  const salaryMax = positiveAmount(position.salaryMax)
  if (salaryUnit === '面议' || (salaryMin == null && salaryMax == null))
    return '面议'

  const period = SALARY_PERIOD[salaryUnit] || ''
  if (salaryMin != null && salaryMax != null) {
    if (salaryMin === salaryMax)
      return `${formatAmount(salaryMin, salaryUnit)}${period}`
    return `${formatAmount(salaryMin, salaryUnit)}-${formatAmount(salaryMax, salaryUnit)}${period}`
  }
  if (salaryMin != null)
    return `${formatAmount(salaryMin, salaryUnit)}${period}起`
  return `最高${formatAmount(salaryMax!, salaryUnit)}${period}`
}
