export interface ApiResponse<T = null> {
  message: string
  data: T
}

export interface UrlRecord {
  orig: string
  short: string
  created_at: string // UTC "YYYY-MM-DD HH:MM:SS"
  expires_at: string | null
}

export type ExpiresIn = '1h' | '12h' | '1d' | '7d' | 'never'

export const KEYWORD_RE = /^[A-Za-z0-9]+$/
export const FORBIDDEN_KEYWORDS = new Set(['login', 'admin', 'logout', 'api', 'index', 'index.html', 'change_pass'])
