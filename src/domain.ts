export type MemoryType = "recall" | "cloze" | "choice";
export type ReviewRating = "again" | "hard" | "good";
export type ContentDisplayMode = "off" | "after-answer" | "always";
export type StudyTaskStatus = "active" | "paused" | "completed";

export const QUESTION_EXPLANATION_LABEL = "题目解析" as const;

export interface LibraryGroup {
  id: string;
  parentId?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Library {
  id: string;
  groupId?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryItem {
  id: string;
  libraryId: string;
  batchId: string;
  type: MemoryType;
  question?: string;
  answer?: string;
  content?: string;
  options?: string[];
  correctIndex?: number;
  imageDataUrl?: string;
  note?: string;
  noteDisplay?: ContentDisplayMode;
  explanation?: string;
  explanationDisplay?: ContentDisplayMode;
  /** Legacy values remain readable; new content uses QUESTION_EXPLANATION_LABEL. */
  explanationType?: string;
  favorite?: boolean;
  reviewCount?: number;
  againCount?: number;
  createdAt: number;
  updatedAt: number;
  reviewLevel: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  /** Per-item retention target used by the long-term forgetting curve. */
  retentionFactor?: number;
}

export interface ReviewLog {
  id: string;
  itemId: string;
  libraryId: string;
  reviewedAt: number;
  result: ReviewRating;
  attempts: number;
  reinforcementCount: number;
}

export interface DailyCheckin {
  dateKey: string;
  checkedAt: number;
  reviewedCount: number;
  goodCount: number;
  hardCount: number;
  againCount: number;
  reinforcementCount: number;
}

export interface StudySessionState {
  itemId: string;
  attempts: number;
  worstRating: ReviewRating;
  reinforcementCount: number;
}

export interface StudyTaskSelection {
  libraryIds: string[];
  range: "due" | "all" | "today" | "manual" | "favorites";
  memoryType: MemoryType | "all";
  summary: string;
}

/** Stable task contract. Jia Yuan owns the IndexedDB table and UI implementation. */
export interface StudyTask {
  id: string;
  name: string;
  status: StudyTaskStatus;
  selection: StudyTaskSelection;
  itemIds: string[];
  queue: string[];
  session: Record<string, StudySessionState>;
  completedLogs: ReviewLog[];
  revealed: boolean;
  selectedOption?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
