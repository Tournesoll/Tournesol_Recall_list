import Dexie, { type EntityTable } from 'dexie';

export type MemoryType = 'recall' | 'cloze' | 'choice';
export type ReviewRating = 'again' | 'hard' | 'good';

export interface LibraryGroup { id: string; parentId?: string; name: string; createdAt: number; updatedAt: number; }
export interface Library { id: string; groupId?: string; name: string; createdAt: number; updatedAt: number; }
export interface MemoryItem {
  id: string; libraryId: string; batchId: string; type: MemoryType;
  question?: string; answer?: string; content?: string; options?: string[]; correctIndex?: number; imageDataUrl?: string;
  createdAt: number; updatedAt: number; reviewLevel: number; nextReviewAt: number; lastReviewedAt?: number;
  /** Per-item retention target used by the long-term forgetting curve. */
  retentionFactor?: number;
}
export interface ReviewLog { id: string; itemId: string; libraryId: string; reviewedAt: number; result: ReviewRating; attempts: number; reinforcementCount: number; }
export interface DailyCheckin { dateKey: string; checkedAt: number; reviewedCount: number; goodCount: number; hardCount: number; againCount: number; reinforcementCount: number; }

export class RecallDatabase extends Dexie {
  libraryGroups!: EntityTable<LibraryGroup, 'id'>;
  libraries!: EntityTable<Library, 'id'>;
  items!: EntityTable<MemoryItem, 'id'>;
  reviewLogs!: EntityTable<ReviewLog, 'id'>;
  dailyCheckins!: EntityTable<DailyCheckin, 'dateKey'>;
  constructor() {
    super('recall-lite');
    this.version(1).stores({ libraries: 'id,name,createdAt,updatedAt', items: 'id,libraryId,batchId,type,createdAt,updatedAt,reviewLevel,nextReviewAt,[libraryId+nextReviewAt],[libraryId+createdAt]' });
    this.version(2).stores({ libraryGroups: 'id,name,createdAt,updatedAt', libraries: 'id,groupId,name,createdAt,updatedAt', items: 'id,libraryId,batchId,type,createdAt,updatedAt,reviewLevel,nextReviewAt,[libraryId+nextReviewAt],[libraryId+createdAt]', reviewLogs: 'id,itemId,libraryId,reviewedAt,result,[libraryId+reviewedAt]', dailyCheckins: 'dateKey,checkedAt' });
    this.version(3).stores({ libraryGroups: 'id,name,createdAt,updatedAt', libraries: 'id,groupId,name,createdAt,updatedAt', items: 'id,libraryId,batchId,type,createdAt,updatedAt,reviewLevel,nextReviewAt,[libraryId+nextReviewAt],[libraryId+createdAt]', reviewLogs: 'id,itemId,libraryId,reviewedAt,result,[libraryId+reviewedAt]', dailyCheckins: 'dateKey,checkedAt' });
    this.version(4).stores({ libraryGroups: 'id,parentId,name,createdAt,updatedAt', libraries: 'id,groupId,name,createdAt,updatedAt', items: 'id,libraryId,batchId,type,createdAt,updatedAt,reviewLevel,nextReviewAt,[libraryId+nextReviewAt],[libraryId+createdAt]', reviewLogs: 'id,itemId,libraryId,reviewedAt,result,[libraryId+reviewedAt]', dailyCheckins: 'dateKey,checkedAt' });
  }
}
export const db = new RecallDatabase();
export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const dayStart = (n = Date.now()) => { const d = new Date(n); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayEnd = (n = Date.now()) => { const d = new Date(n); d.setHours(23, 59, 59, 999); return d.getTime(); };
export const isToday = (n: number) => n >= dayStart() && n <= dayEnd();
export const dateKey = (n: number) => { const d = new Date(n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const dateLabel = (key: string) => { const d = new Date(`${key}T00:00:00`); return `${d.getMonth() + 1}月${d.getDate()}日`; };
export const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 15, 30, 60, 120, 240, 365, 730, 1460];
export function applyReview(item: MemoryItem, rating: ReviewRating, now = Date.now()): MemoryItem {
  let next = item.reviewLevel;
  if (rating === 'again') next = 0;
  if (rating === 'hard') next = Math.min(next + 1, REVIEW_INTERVAL_DAYS.length - 1);
  if (rating === 'good') next = Math.min(next + 2, REVIEW_INTERVAL_DAYS.length - 1);
  const currentFactor = item.retentionFactor ?? 0.6;
  const retentionFactor = rating === 'again'
    ? Math.max(0.45, currentFactor - 0.04)
    : rating === 'hard'
      ? Math.min(0.9, currentFactor + 0.01)
      : Math.min(0.95, currentFactor + 0.04);
  return { ...item, reviewLevel: next, retentionFactor, lastReviewedAt: now, nextReviewAt: now + REVIEW_INTERVAL_DAYS[next] * 86400000, updatedAt: now };
}

let seedPromise: Promise<void> | undefined;
export function seedIfEmpty() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    if (await db.libraries.count()) return;
    const now = Date.now();
    const group: LibraryGroup = { id: id('group'), name: '英语', createdAt: now, updatedAt: now };
    const libs: Library[] = [
      { id: id('lib'), groupId: group.id, name: '考研核心词', createdAt: now, updatedAt: now },
      { id: id('lib'), groupId: group.id, name: '2019 Text 1', createdAt: now, updatedAt: now },
      { id: id('lib'), name: '肖八第一套', createdAt: now, updatedAt: now },
      { id: id('lib'), name: '线性代数公式', createdAt: now, updatedAt: now },
    ];
    const samples: Array<Omit<MemoryItem, 'id' | 'libraryId' | 'batchId' | 'createdAt' | 'updatedAt' | 'reviewLevel' | 'nextReviewAt'>> = [
      { type: 'recall', question: 'abandon', answer: '放弃；抛弃' },
      { type: 'cloze', content: '中华人民共和国成立于{{1949年}}。' },
      { type: 'choice', question: '新发展理念包括哪些？', options: ['创新、协调、绿色、开放、共享', '改革、发展、稳定', '民主、自由、平等'], correctIndex: 0 },
      { type: 'cloze', content: '导数的几何意义是曲线在该点的{{切线斜率}}。' },
    ];
    const items: MemoryItem[] = samples.map((sample, i) => ({ id: id('item'), libraryId: libs[i % libs.length].id, batchId: id('batch'), ...sample, createdAt: now - i * 3600000, updatedAt: now - i * 3600000, reviewLevel: 0, nextReviewAt: now }));
    await db.transaction('rw', db.libraryGroups, db.libraries, db.items, async () => { await db.libraryGroups.add(group); await db.libraries.bulkAdd(libs); await db.items.bulkAdd(items); });
  })();
  return seedPromise;
}
