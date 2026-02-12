import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { importQuestionsFromDocx } from '@/lib/docx-import';

export const dynamic = 'force-dynamic';

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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.docx') && !file.type.includes('wordprocessingml')) {
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

    // Import questions from docx
    const questions = await importQuestionsFromDocx(buffer);

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    console.error('Error importing docx:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import questions from docx' },
      { status: 500 }
    );
  }
}

