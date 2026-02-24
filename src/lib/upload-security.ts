import { join, normalize } from 'path'

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
}

export function extensionForMime(mimeType: string, fallback = 'bin'): string {
  if (!mimeType) return fallback
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] || fallback
}

/**
 * Convert a stored /uploads/... URL path to an absolute file path safely.
 * Returns null when the path is invalid or attempts traversal.
 */
export function resolveSafePublicUploadPath(uploadUrlPath: string | null | undefined): string | null {
  if (!uploadUrlPath || typeof uploadUrlPath !== 'string') return null
  if (!uploadUrlPath.startsWith('/uploads/')) return null
  if (uploadUrlPath.includes('\0')) return null

  const normalized = normalize(uploadUrlPath).replace(/\\/g, '/')
  if (!normalized.startsWith('/uploads/') || normalized.includes('..')) return null

  const relativeFromPublic = normalized.replace(/^\/+/, '')
  if (!relativeFromPublic.startsWith('uploads/')) return null

  return join(process.cwd(), 'public', relativeFromPublic)
}
