import { mkdir } from 'fs/promises'
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

const PRIVATE_UPLOADS_ROOT = join(process.cwd(), 'private_uploads')

function normalizePrivateRelativePath(value: string): string | null {
  if (!value || value.includes('\0')) return null
  const normalized = normalize(value).replace(/\\/g, '/')

  if (!normalized || normalized.startsWith('/') || normalized.startsWith('..')) return null
  if (normalized.includes('/../') || normalized.endsWith('/..')) return null

  return normalized
}

export async function ensurePrivateUploadDir(scope: string): Promise<string> {
  const normalizedScope = normalizePrivateRelativePath(scope)
  if (!normalizedScope) {
    throw new Error('Invalid private upload scope')
  }

  const absoluteDir = join(PRIVATE_UPLOADS_ROOT, normalizedScope)
  await mkdir(absoluteDir, { recursive: true })
  return absoluteDir
}

export function buildPrivateUploadPath(scope: string, filename: string): string {
  const normalizedScope = normalizePrivateRelativePath(scope)
  if (!normalizedScope) {
    throw new Error('Invalid private upload scope')
  }
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
    throw new Error('Invalid private upload filename')
  }

  return `${normalizedScope}/${filename}`
}

export function resolveSafePrivateUploadPath(privateUploadPath: string | null | undefined): string | null {
  if (!privateUploadPath || typeof privateUploadPath !== 'string') return null

  const normalized = normalizePrivateRelativePath(privateUploadPath)
  if (!normalized) return null

  return join(PRIVATE_UPLOADS_ROOT, normalized)
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

/**
 * Resolve either a private storage path (new) or /uploads/... path (legacy).
 * Returns null if the path is invalid.
 */
export function resolveSafeStoredUploadPath(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null
  if (storedPath.startsWith('/uploads/')) {
    return resolveSafePublicUploadPath(storedPath)
  }
  return resolveSafePrivateUploadPath(storedPath)
}
