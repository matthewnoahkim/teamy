export type ImportedQuestionType = "free_response" | "multiple_choice" | "select_all" | "true_false" | "fill_blank" | "text_block";

export interface ImportedChoice {
  label: string;              // "A", "B", ...
  text: string;
  correct: boolean;
}

export interface ImportedFRQPart {
  label: string;              // "a", "b", "c", etc.
  prompt: string;
  points: number | null;
}

export interface ImportedQuestion {
  id: string;
  type: ImportedQuestionType;
  prompt: string;
  context: string | null;
  choices: ImportedChoice[];  // [] for free_response
  points: number | null;
  frqParts?: ImportedFRQPart[];  // For multi-part FRQs
}

