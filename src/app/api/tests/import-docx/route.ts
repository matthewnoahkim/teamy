import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { importQuestionsFromDocx } from '@/lib/docx-import';
import {
  createRateLimitResponse,
  rateLimitRequest,
} from '@/lib/rate-limit-api';

export const dynamic = 'force-dynamic';

const DOCX_IMPORT_RATE_LIMIT: {
  limit: number;
  window: number;
  identifier: string;
} = {
  limit: 5,
  window: 60 * 60,
  identifier: 'DOCX import',
};

/**
 * POST /api/tests/import-docx
 * Accepts a multipart/form-data upload with "file" field.
 * Returns { questions: ImportedQuestion[] }
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rateLimitResult = await rateLimitRequest(
      req,
      session.user.id,
      DOCX_IMPORT_RATE_LIMIT,
      '/api/tests/import-docx'
    );
    const rateLimitResponse = createRateLimitResponse(
      rateLimitResult,
      DOCX_IMPORT_RATE_LIMIT
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const hasDocxExtension = /\.docx$/i.test(file.name);
    const allowedMimeTypes = new Set([
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '',
    ]);
    const hasAllowedMimeType = allowedMimeTypes.has(file.type);
    if (!hasDocxExtension || !hasAllowedMimeType) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .docx file.' },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hasZipSignature =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
      (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);
    if (!hasZipSignature) {
      return NextResponse.json(
        { error: 'Invalid .docx file format.' },
        { status: 400 }
      );
    }

    // Import questions from docx
    const questions = await importQuestionsFromDocx(buffer);

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    console.error('Error importing docx:', error);
    return NextResponse.json(
      { error: 'Failed to import questions from docx' },
      { status: 500 }
    );
  }
}
