export const PLAYER_NAME_MAX_LENGTH = 16;
export const LEADERBOARD_LIMIT = 5;
export const MAX_LEADERBOARD_SCORE = 999_999_999;
export const MAX_LEADERBOARD_LEVEL = 9_999;

export function normalizePlayerName(value) {
  const collapsed = String(value ?? '').trim().replace(/\s+/g, ' ');
  return Array.from(collapsed).slice(0, PLAYER_NAME_MAX_LENGTH).join('');
}

export function normalizeLeaderboardScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(MAX_LEADERBOARD_SCORE, Math.floor(score)));
}

export function normalizeLeaderboardLevel(value) {
  if (value === null || value === undefined || value === '') return null;
  const level = Number(value);
  if (!Number.isFinite(level) || level < 1) return null;
  return Math.min(MAX_LEADERBOARD_LEVEL, Math.floor(level));
}

export function normalizeLeaderboardDate(value) {
  const candidate = typeof value?.toDate === 'function' ? value.toDate() : value;
  if (candidate === null || candidate === undefined || candidate === '') return null;
  const date = candidate instanceof Date ? candidate : new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function prepareLeaderboardEntries(entries, limit = LEADERBOARD_LIMIT) {
  return entries
    .map((entry) => ({
      id: String(entry.id ?? ''),
      displayName: normalizePlayerName(entry.displayName) || 'Anonymous',
      bestScore: normalizeLeaderboardScore(entry.bestScore),
      bestLevel: normalizeLeaderboardLevel(entry.bestLevel),
      savedAt: normalizeLeaderboardDate(entry.updatedAt),
    }))
    .sort((left, right) => (
      right.bestScore - left.bestScore
      || left.displayName.localeCompare(right.displayName)
      || left.id.localeCompare(right.id)
    ))
    .slice(0, limit);
}
