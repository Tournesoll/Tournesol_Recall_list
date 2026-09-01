import type { MemoryItem, MemoryType, ReviewRating } from "./domain";

interface ImportedCardBase {
  explanation?: string;
}

export interface ImportedRecallCard extends ImportedCardBase {
  type: "recall";
  question: string;
  answer: string;
}

export interface ImportedClozeCard extends ImportedCardBase {
  type: "cloze";
  content: string;
}

export interface ImportedChoiceCard extends ImportedCardBase {
  type: "choice";
  question: string;
  options: string[];
  correctIndex: number;
}

export type ImportedCard =
  | ImportedRecallCard
  | ImportedClozeCard
  | ImportedChoiceCard;

export interface AiImportPayload {
  version: 1;
  items: ImportedCard[];
}

export interface AiImportOptions {
  allowedTypes: MemoryType[];
  includeExplanation: boolean;
}

export type StudyCardAiContext = Pick<
  MemoryItem,
  | "id"
  | "type"
  | "question"
  | "answer"
  | "content"
  | "options"
  | "correctIndex"
  | "explanation"
>;

export type StudyAnalysisRangeDays = 7 | 30;

export interface DailyStudyMetrics {
  dateKey: string;
  reviewedCount: number;
  goodCount: number;
  hardCount: number;
  againCount: number;
  reinforcementCount: number;
  addedCount: number;
  dueCount: number;
}

export interface LibraryStudyMetrics {
  libraryId: string;
  libraryName: string;
  reviewedCount: number;
  ratings: Record<ReviewRating, number>;
  reinforcementCount: number;
  dueCount: number;
}

/** Only aggregate learning data crosses the records-page AI boundary. */
export interface StudyAnalysisSummary {
  rangeDays: StudyAnalysisRangeDays;
  generatedAt: number;
  totals: Omit<DailyStudyMetrics, "dateKey">;
  daily: DailyStudyMetrics[];
  libraries: LibraryStudyMetrics[];
}
