// In-memory matchmaking queue — shared across API routes
// In production, replace with Redis or similar
export const queue = new Map<string, { queuedAt: number; contestType: string }>();
