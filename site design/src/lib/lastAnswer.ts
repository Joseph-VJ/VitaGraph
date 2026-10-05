export interface LastAnswerRecord {
  userId: string;
  question: string;
  chunkIds: string[];
  timestamp: number;
}

const STORAGE_KEY = "vitagraph:last_answer";

export function saveLastAnswer(data: {
  userId: string;
  question: string;
  chunkIds: string[];
}): void {
  try {
    const record: LastAnswerRecord = {
      userId: data.userId,
      question: data.question,
      chunkIds: data.chunkIds,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable: ignore */
  }
}

export function readLastAnswer(userId: string): LastAnswerRecord | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as LastAnswerRecord;
    if (record && record.userId === userId && Array.isArray(record.chunkIds)) {
      return record;
    }
    return null;
  } catch {
    return null;
  }
}
