export interface SwipePoint {
  x: number
  y: number
}

export interface BackSwipeOptions {
  minDistance?: number
  maxVerticalDistance?: number
  edgeStartMaxX?: number
}

export function isPageBackSwipe(
  start: SwipePoint,
  end: SwipePoint,
  options: BackSwipeOptions = {},
) {
  const minDistance = options.minDistance ?? 80
  const maxVerticalDistance = options.maxVerticalDistance ?? 80
  const edgeStartMaxX = options.edgeStartMaxX ?? 36
  const deltaX = end.x - start.x
  const deltaY = Math.abs(end.y - start.y)

  if (deltaY > maxVerticalDistance)
    return false

  return deltaX <= -minDistance
    || (start.x <= edgeStartMaxX && deltaX >= minDistance)
}
