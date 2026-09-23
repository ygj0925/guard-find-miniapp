import type { PositionLocationOption } from '@/api/position'

/** Include a parent location when all its selectable descendants are selected. */
export function collectSelectedLocationIds(options: PositionLocationOption[], selectedLeafIds: string[]): string[] {
  const selectedLeaves = new Set(selectedLeafIds)
  const selectedIds = new Set<string>()

  function visit(option: PositionLocationOption): boolean {
    if (!option.value || option.label.trim() === '全国')
      return false

    const children = (option.children || []).filter(child => child.value && child.label.trim() !== '全国')
    const allSelected = children.length
      ? children.map(visit).every(Boolean)
      : selectedLeaves.has(option.value)
    if (allSelected)
      selectedIds.add(option.value)
    return allSelected
  }

  options.forEach(visit)
  return Array.from(selectedIds)
}
