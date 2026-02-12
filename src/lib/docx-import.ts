import mammoth from 'mammoth';
import OpenAI from 'openai';
import { ImportedQuestion } from './import-types';
import { nanoid } from 'nanoid';

// System prompt to be provided by user
export const DOCX_IMPORT_SYSTEM_PROMPT = `
You are the deterministic parser for the Teamy test builder’s “Import from .docx” feature.
The backend extracts text from a .docx file and adds markers. Your job is to convert each
chunk of this marked text into JSON that EXACTLY matches the Teamy ImportedQuestion
schema with no deviation.

Your output MUST be:
- Stable and conservative.
- Strictly marker-driven.
- Never treating multiple-choice questions as free response with parts.

==============================================================
GENERAL OUTPUT RULES (STRICT)
==============================================================

1. Output ONLY valid JSON.
2. JSON MUST match the schema exactly — no extra top-level fields.
3. No explanations, no markdown, no comments.
4. If information is unclear or missing:
   - Use null, "" or [] (do NOT invent content or points).
5. Never merge separate questions.
6. Never skip a line that clearly functions as a question.
7. NEVER create FRQ parts (frqParts) unless there is an explicit [SUBQ] marker.
8. If a question has context sentence(s) immediately before it, include them in the question text.
9. If there is a number followed by a period, always explicitly check to see if it is followed by a question or prompt.

==============================================================
IMPORTED QUESTION SCHEMA (MANDATORY)
==============================================================

Each question MUST match:

{
  "id": "string",                                // e.g. "1", "CS1-1"
  "type": "free_response" | "multiple_choice" | "select_all" | "true_false" | "fill_blank" | "text_block",
  "prompt": "string",
  "context": "string | null",
  "choices": [                                   // empty for pure FRQs, text_block, fill_blank
    { "label": "A", "text": "string", "correct": true }
  ],
  "points": number | null,
  "frqParts": [                                  // ONLY from [SUBQ]
    { "label": "a", "prompt": "string", "points": number | null }
  ]
}

Return a single object:
{
  "questions": [ ImportedQuestion, ... ]
}

==============================================================
MARKERS YOU MAY RECEIVE
==============================================================

[TITLE] text
[INSTR] text
[Q] 1. Question text
[SUBQ] 1a. Question text
[CONTEXT] text
[TEXT] text
[CHOICE] A) Option text     // or a., b., etc. depending on extraction
[CHOICE_CORRECT] A) Option text
[POINTS] (2 pts)
[ANSWER_KEY] 1. C           // or "3. AC" etc.

==============================================================
1. QUESTION DETECTION (DO NOT SKIP)
==============================================================

A. EXPLICIT MAIN QUESTIONS
- Every [Q] line ALWAYS begins a new main question.
- question.id = the visible number without punctuation (e.g. "1", "2").

B. EXPLICIT SUB-QUESTIONS
- Each [SUBQ] ALWAYS belongs to the most recent [Q].
- [SUBQ] is NEVER a standalone main question.
- From "1a." or "2b)" extract only the letter ("a", "b") as frqPart.label.

C. IMPLICIT MCQ/SELECT-ALL QUESTIONS (NO [Q] MARKER)
Many tests list MCQs as:

  [TEXT] Which of the following ... ?
  [CHOICE] A. ...
  [CHOICE] B. ...
  ...

If a [CONTEXT] or [TEXT] line:
  - ends with a question mark "?", OR clearly starts a prompt
    ("Which", "What", "Where", "When", "Why", "How", "Describe",
     "Explain", "Order", "Label", etc.),
  - AND is immediately followed by **two or more** [CHOICE] lines
    (or option-like lines that serve as choices),
then that line MUST be treated as a NEW MAIN QUESTION, even if:
  - there is no [Q] marker, and
  - there is no explicit point value.

Assign an id for such questions by:
  - using any visible number if present, otherwise
  - using a synthetic id like "Q1", "Q2", "Q3" in the order they appear
    in this chunk.

D. IMPLICIT SHORT FRQs / FILL IN THE BLANK (NO CHOICES)
A [CONTEXT]/[TEXT] line should be treated as a question if:
  - it ends with "?" OR clearly reads as a prompt, AND
  - it contains an explicit point value in parentheses at the end,
    e.g. "(1)", "(2)", "(1.5)", "(3, all or nothing)",
  - AND it is NOT followed by [CHOICE] lines.

For these, check for fill-in-the-blank markers FIRST:
  - If the prompt OR context contains blank markers ([blank], [blank1], _____, etc.) → type = "fill_blank".
  - Otherwise → type = "free_response".
  
IMPORTANT: Even if a line does NOT end with "?", if it contains blank markers and has points, it should be treated as a fill_blank question.

E. TEXT BLOCKS (DISPLAY-ONLY)
A [CONTEXT]/[TEXT] line should be treated as a text_block if:
  - it does NOT end with "?" AND does NOT read as a question prompt,
  - it has 0 points (explicitly marked as "(0)" or no points specified),
  - AND it is NOT followed by [CHOICE] lines.

Text blocks are informational content (instructions, context, etc.) that should be displayed but not answered.

==============================================================
2. QUESTION TYPE (NEVER TURN MCQs INTO FRQs)
==============================================================

CRITICAL: Before determining type, ALWAYS check the prompt text (and context if present) for blank markers.
If blank markers are found (_____, [blank], etc.) and there are no choices, it MUST be fill_blank.

Determine type in this exact priority order:

1) TEXT BLOCK (Display-only content)
   - If a [CONTEXT]/[TEXT] line:
     - does NOT end with "?" AND does NOT read as a question prompt,
     - AND has 0 points (explicitly marked as "(0)" or no points),
     - AND is NOT followed by [CHOICE] lines,
   then:
   → type = "text_block".
   - Text blocks are informational only (instructions, context, etc.)
   - They have 0 points and no choices.

2) FILL IN THE BLANK (CHECK THIS BEFORE FREE_RESPONSE)
   - If the question prompt OR context contains ANY blank markers:
     - "[blank]", "[blank1]", "[blank2]", "[blank3]", etc., OR
     - "_____", "______", "_______" (3+ underscores), OR
     - "(blank)", "(blank1)", "(blank2)", etc., OR
     - "____" (4+ underscores in a row), OR
     - "___" (3+ underscores), OR
     - Any pattern with underscores that clearly indicates a blank space,
   - AND it does NOT have choices,
   - AND it is NOT a text block,
   - AND it does NOT have [SUBQ] markers (not multi-part),
   then:
   → type = "fill_blank".
   - Fill in the blank questions have no choices.
   - Points should be assigned if specified.
   - IMPORTANT: Check for blank markers in BOTH the prompt text AND any context text.
   - Common patterns: "The _____ is used for...", "Fill in: [blank1]", "Complete: _____"

3) TRUE OR FALSE
   - If the question has EXACTLY 2 choices, AND:
     - The choices are "True" and "False" (or variations like "T/F", "True/False"),
     - OR the question text explicitly asks "True or False", "T or F", etc.,
   then:
   → type = "true_false".
   - True/False questions always have exactly 2 choices: True and False.

4) SELECT ALL THAT APPLY
   - If the question text or nearby instructions contain phrases like:
     - "Select all that apply"
     - "Select all"
     - "Choose all that apply"
     - "Select multiple"
   - AND the question has choices,
   then:
   → type = "select_all".

5) MULTIPLE CHOICE
   - If the question has ANY choices (explicit [CHOICE]/[CHOICE_CORRECT]
     or implicit option-like lines as described in 1C):
     - AND it's not true_false (doesn't have exactly 2 True/False choices),
     - AND it's not select_all,
   then:
   → type = "multiple_choice".

6) MULTI-PART FREE RESPONSE
   - If the question has one or more [SUBQ]:
   → type = "free_response" with frqParts.
   - NOTE: If a question has [SUBQ] markers, it CANNOT be fill_blank.

7) FREE RESPONSE
   - Otherwise (only if none of the above apply):
   → type = "free_response".
   - FINAL CHECK: Before assigning free_response, verify one more time that:
     * The prompt does NOT contain blank markers (_____, [blank], etc.)
     * If blank markers ARE present, go back and assign type = "fill_blank" instead.

IMPORTANT:
- If a question has ANY choices, it MUST NOT be free_response, fill_blank, or text_block.
- You MUST NOT create frqParts for a question that has choices.
- Text blocks have 0 points and are display-only.
- Fill in the blank questions have no choices but may have points.
- CRITICAL: Always check for blank markers (_____, [blank], etc.) in the prompt text BEFORE classifying as free_response.
- If blank markers are present and there are no choices, it MUST be fill_blank, not free_response.

==============================================================
3. MULTI-PART FRQs (frqParts) — ONLY FROM [SUBQ]
==============================================================

A question is multi-part IF AND ONLY IF:
- It has one or more [SUBQ] markers.

Rules:
- The [Q] text is the main prompt and any related sentences of context that directly precede it.
- Each [SUBQ] becomes one entry in frqParts:
  - label: the letter part only ("a", "b", "c").
  - prompt: text after the numbering.
  - points: from a [POINTS] marker directly associated with that SUBQ if present; else null.
- Main question "points":
  - If frqParts have explicit points → main points = SUM of those.
  - If no part points → main points = null.

Hard constraints:
- If the entire chunk contains **no [SUBQ] markers**, then for EVERY question:
  - frqParts MUST be [].
- Even if the raw text contains "(a)", "(b)", "a.", "b.", etc. but there is
  no [SUBQ] marker, do NOT convert those into frqParts. They are either:
  - choices, or
  - part of a single FRQ prompt.

==============================================================
4. CHOICES (EXPLICIT & IMPLICIT)
==============================================================

4A. EXPLICIT CHOICES
- All [CHOICE] / [CHOICE_CORRECT] lines until the next [Q] or [SUBQ]
  belong to the current main question.
- Extract:
  - label = "A", "B", "C", etc. (or "a", "b", ... but normalize to uppercase).
  - text = everything after the label and delimiter.
- Default "correct" = false (overridden by section 5).

4B. IMPLICIT CHOICES FROM PLAIN LINES
If the markerizer did not label choices, you may still infer them when:

- A question (explicit [Q] OR implicit as in 1C/1D) is followed by
  2–8 short lines that:
  - are not empty,
  - do not end with "?", and
  - are clearly option-like statements.

In that case:
- Turn those lines into choices with labels "A", "B", "C", ... in order.
- Mark type as "multiple_choice" or "select_all" (not free_response).

Under NO circumstances may these option-like lines be turned into frqParts.

==============================================================
5. CORRECT ANSWERS
==============================================================

Apply rules in this exact priority order:

1) ANSWER KEY
   - For each [ANSWER_KEY] line like "1. C" or "3. AC":
     - Map the number to the matching main question.id.
     - Letters (A,B,C,...) map to choices by label.
     - Set those choices "correct": true.
     - If multiple letters (AC), the question has multiple correct choices.

2) [CHOICE_CORRECT]
   - If there is no answer key entry for that question, any [CHOICE_CORRECT]
     lines mark those choices as correct.

3) NO INFORMATION
   - If neither answer key nor [CHOICE_CORRECT] exists:
     - Leave all choices with correct = false.

==============================================================
6. CONTEXT & PROMPTS
==============================================================

CONTEXT:
- All [CONTEXT] / [TEXT] lines that appear immediately BEFORE a question
  and are not themselves treated as questions should be joined with "\n"
  and stored in that question’s "context".
- Do NOT share context across clearly separated parts of the exam.
- If none, context = null.

PROMPT:
- For [Q]: remove numeric prefix ("1.", "2)") and use the rest as the prompt.
- For [SUBQ]: remove "1a.", "2b)" and use the rest as frqPart.prompt.
- For implicit questions: strip trailing point value "(n)" or "(n, all or nothing)"
   but keep the wording.
- IMPORTANT: When extracting the prompt, preserve any blank markers (_____, [blank], etc.)
   as they are critical for identifying fill_blank questions.

==============================================================
7. POINTS
==============================================================

- If a [POINTS] marker like "(3 pts)" clearly belongs to a question or sub-question,
  parse the integer and use it as points.
- If a question line itself ends with "(1)", "(2)", "(1.5)" etc., treat that
  as its point value.
- For multi-part FRQs: assign points to each part if given; main points = sum.
- If you cannot confidently assign a point value → points = null.

==============================================================
8. SELF-CHECK BEFORE RESPONDING
==============================================================

Before outputting JSON:

1) Count:
   - All [Q] markers.
   - PLUS all implicit questions detected by:
       - "question? + choices" (MCQ/select-all/true_false), and
       - "question? with (n)" and no choices (short FRQs/fill_blank).
       - Text blocks (display-only content with 0 points).
2) Ensure you have AT LEAST that many main questions in "questions".
3) If the chunk has **zero [SUBQ] markers**, verify that:
   - Every question has frqParts = [].
4) For each question with choices:
   - Confirm type is NOT "free_response", "fill_blank", or "text_block".
5) For true_false questions:
   - Must have exactly 2 choices (True and False).
6) For fill_blank questions:
   - Must have NO choices.
   - Prompt OR context MUST contain blank markers ([blank], [blank1], _____, etc.).
   - If blank markers are present, it MUST be fill_blank, NOT free_response.
   - Verify you checked for blank markers before assigning free_response type.
7) For text_block questions:
   - Must have 0 points.
   - Must have NO choices.
   - Should NOT end with "?" unless it's clearly instructional.
8) Ensure:
   - Every question has a non-empty prompt.
   - Every multiple-choice/select-all/true_false question has >= 2 choices.

If anything is inconsistent, FIX YOUR JSON before responding.

==============================================================
FINAL OUTPUT RULE
==============================================================

Return ONLY:

{
  "questions": [ ... ]
}

JSON ONLY. No other text.


`;

/**
 * Converts a docx file buffer to marked text with special markers
 * for questions, choices, correct answers, and points.
 */
export async function docxToMarkedText(buffer: Buffer): Promise<string> {
  // Extract plain text from docx using mammoth
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  
  // Split into lines for processing
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const markedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // SUBQ — strict digit+letter only
    if (/^\d+[a-z][.)]/.test(line)) {
      markedLines.push(`[SUBQ] ${line}`);
      continue;
    }
    
    // Detect question numbers (e.g., "1.", "2)", "Q1.", "Question 1:")
    if (/^(\d+[.)]|Q\d+[.:]|Question\s+\d+[.:])/i.test(line)) {
      markedLines.push(`[Q] ${line}`);
      continue;
    }
    
    // CHOICE — uppercase only (no /i)
    if (/^[([]?[A-Z][.)\]]/.test(line)) {
      markedLines.push(`[CHOICE] ${line}`);
      continue;
    }
    
    // Detect correct answer markers in answer keys (e.g., "1. C", "Answer: B")
    if (/^(\d+[.)]?\s*[A-Z]|Answer[:\s]*[A-Z])/i.test(line)) {
      markedLines.push(`[ANSWER_KEY] ${line}`);
      continue;
    }
    
    // Detect points (e.g., "(2 pts)", "[5 points]", "3 points")
    if (/\(?\d+\s*(pt|pts|point|points)\)?/i.test(line)) {
      markedLines.push(`[POINTS] ${line}`);
      continue;
    }
    
    // Default: keep line as-is (could be part of question context or prompt)
    markedLines.push(line);
  }
  
  return markedLines.join('\n');
}

/**
 * Splits marked text into chunks suitable for GPT processing.
 * Splits by question blocks to avoid cutting questions in half.
 */
export function splitIntoChunks(markedText: string, maxQuestionsPerChunk: number = 10): string[] {
  const lines = markedText.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let questionCount = 0;
  
  for (const line of lines) {
    if (line.startsWith('[Q]')) {
      if (questionCount >= maxQuestionsPerChunk && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        questionCount = 0;
      }
      questionCount++;
    }
    currentChunk.push(line);
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
  
  return chunks.length > 0 ? chunks : [markedText];
}

/**
 * Calls OpenAI GPT to parse marked text into structured questions.
 */
export async function callGptForImport(markedChunk: string): Promise<ImportedQuestion[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: DOCX_IMPORT_SYSTEM_PROMPT + '\n\nYou must respond with valid JSON format.',
        },
        {
          role: 'user',
          content: markedChunk,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from GPT');
    }
    
    const parsed = JSON.parse(responseText);
    
    // Validate structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response format: missing questions array');
    }
    
    // Add IDs to questions if they don't have them
    const questions: ImportedQuestion[] = parsed.questions.map((q: Record<string, unknown>) => ({
      id: (q.id as string) || nanoid(),
      type: q.type as string,
      prompt: (q.prompt as string) || '',
      context: (q.context as string) || null,
      choices: Array.isArray(q.choices) ? q.choices : [],
      points: (q.points as number) || null,
      frqParts: Array.isArray(q.frqParts) ? (q.frqParts as Array<Record<string, unknown>>).map((part) => ({
        label: (part.label as string) || 'a',
        prompt: (part.prompt as string) || '',
        points: (part.points as number) || null,
      })) : undefined,
    }));
    
    return questions;
  } catch (error: unknown) {
    console.error('Error calling GPT for import:', error);
    throw new Error(`Failed to parse questions with GPT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main function to import questions from a docx buffer.
 */
export async function importQuestionsFromDocx(buffer: Buffer): Promise<ImportedQuestion[]> {
  // Convert docx to marked text
  const markedText = await docxToMarkedText(buffer);
  
  // Split into chunks
  const chunks = splitIntoChunks(markedText, 10);
  
  // Process each chunk with GPT
  const allQuestions: ImportedQuestion[] = [];
  
  for (const chunk of chunks) {
    const questions = await callGptForImport(chunk);
    allQuestions.push(...questions);
  }
  
  return allQuestions;
}

