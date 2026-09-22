export interface MiniProgramShare {
  title: string
  path: string
}

export interface MiniProgramTimelineShare {
  title: string
  query?: string
}

export function createMiniProgramShare(title: string, path: string): MiniProgramShare {
  return { title, path }
}

export function createMiniProgramTimelineShare(
  title: string,
  query?: string,
): MiniProgramTimelineShare {
  return query ? { title, query } : { title }
}
