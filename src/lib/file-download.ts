import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import { resolveSafeStoredUploadPath } from '@/lib/upload-security'

function sanitizeDownloadFilename(filename: string): string {
  const trimmed = filename.trim()
  if (!trimmed) return 'download'
  return trimmed
    .replace(/[\r\n"]/g, '')
    .replace(/[\\/]/g, '_')
    .slice(0, 255)
}

export async function createStoredFileDownloadResponse(params: {
  storedPath: string | null | undefined
  mimeType?: string | null
  filename?: string | null
  inline?: boolean
}): Promise<NextResponse> {
  const absolutePath = resolveSafeStoredUploadPath(params.storedPath)
  if (!absolutePath) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  try {
    const fileStat = await stat(absolutePath)
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const stream = createReadStream(absolutePath)
    const body = Readable.toWeb(stream) as ReadableStream<Uint8Array>
    const filename = sanitizeDownloadFilename(params.filename || 'download')
    const disposition = params.inline ? 'inline' : 'attachment'

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': params.mimeType || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(fileStat.size),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
