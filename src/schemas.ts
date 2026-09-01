import { z } from 'zod';

const recall = z.object({ type: z.literal('recall'), question: z.string().trim().min(1), answer: z.string().trim().min(1) });
const cloze = z.object({ type: z.literal('cloze'), content: z.string().trim().min(1).refine(value => /\{\{[\s\S]+?\}\}/.test(value), '遮挡背诵必须包含 {{答案}}') });
const choice = z.object({ type: z.literal('choice'), question: z.string().trim().min(1), options: z.array(z.string().trim().min(1)).min(2).max(6), correctIndex: z.number().int().min(0) }).refine(value => value.correctIndex < value.options.length, 'correctIndex 超出选项范围');
const explanationFields = { explanation: z.string().trim().optional() };
const recallWithExplanation = recall.extend(explanationFields);
const clozeWithExplanation = cloze.extend(explanationFields);
const choiceWithExplanation = choice.extend(explanationFields);
export const importedItemSchema = z.discriminatedUnion('type', [recallWithExplanation, clozeWithExplanation, choiceWithExplanation]);
export const aiImportSchema = z.object({ version: z.literal(1), items: z.array(importedItemSchema).min(1).max(1000) });
const libraryGroupSchema = z.object({ id: z.string(), parentId: z.string().optional(), name: z.string(), createdAt: z.number(), updatedAt: z.number() });
const librarySchema = z.object({ id: z.string(), groupId: z.string().optional(), name: z.string(), createdAt: z.number(), updatedAt: z.number() });
const itemSchema = z.object({ id: z.string(), libraryId: z.string(), batchId: z.string(), type: z.enum(['recall', 'cloze', 'choice']), question: z.string().optional(), answer: z.string().optional(), content: z.string().optional(), options: z.array(z.string()).optional(), correctIndex: z.number().optional(), imageDataUrl: z.string().optional(), note: z.string().optional(), noteDisplay: z.enum(['off', 'always', 'after-answer']).optional(), explanation: z.string().optional(), explanationDisplay: z.enum(['off', 'always', 'after-answer']).optional(), explanationType: z.string().optional(), favorite: z.boolean().optional(), reviewCount: z.number().optional(), againCount: z.number().optional(), createdAt: z.number(), updatedAt: z.number(), reviewLevel: z.number(), nextReviewAt: z.number(), lastReviewedAt: z.number().optional(), retentionFactor: z.number().min(0.1).max(0.99).optional() });
const logSchema = z.object({ id: z.string(), itemId: z.string(), libraryId: z.string(), reviewedAt: z.number(), result: z.enum(['again', 'hard', 'good']), attempts: z.number(), reinforcementCount: z.number() });
const checkinSchema = z.object({ dateKey: z.string(), checkedAt: z.number(), reviewedCount: z.number(), goodCount: z.number(), hardCount: z.number(), againCount: z.number(), reinforcementCount: z.number() });
export const backupSchemaV2 = z.object({ schemaVersion: z.literal(2), exportedAt: z.number(), libraryGroups: z.array(libraryGroupSchema), libraries: z.array(librarySchema), items: z.array(itemSchema), reviewLogs: z.array(logSchema), dailyCheckins: z.array(checkinSchema) });
export const backupSchemaV1 = z.object({ schemaVersion: z.literal(1), exportedAt: z.number(), libraries: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.number(), updatedAt: z.number() })), items: z.array(itemSchema) });
export const normalizeJsonInput = (input: string) => { let text = input.trim(); if (text.startsWith('```json')) text = text.slice(7); else if (text.startsWith('```')) text = text.slice(3); if (text.endsWith('```')) text = text.slice(0, -3); return text.trim(); };
