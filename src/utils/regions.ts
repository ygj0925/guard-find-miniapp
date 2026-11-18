import type { RegionNode } from '@/api/property'

export function regionCityNames(tree: RegionNode[]): string[] {
  return [...new Set(tree.flatMap(p => [110000, 120000, 310000, 500000].includes(p.code) || !p.children?.length ? [p.name] : p.children.map(c => c.name)))]
}

/** Keep official codes unchanged; duplicated nodes are presentation-only municipality/county columns. */
export function regionColumns(tree: RegionNode[]): RegionNode[] {
  return tree.map((province) => {
    const children = province.children || []
    if ([110000, 120000, 310000, 500000].includes(province.code))
      return { ...province, children: [{ ...province, children }] }
    return { ...province, children: children.length ? children.map(city => ({ ...city, children: city.children?.length ? city.children : [{ ...city, children: [] }] })) : [{ ...province, children: [{ ...province, children: [] }] }] }
  })
}
