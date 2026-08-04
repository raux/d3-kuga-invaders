import { describe, expect, it } from 'vitest';
import { getFirebaseConfiguration } from '../src/leaderboard/firebase-config.js';
import {
  MAX_LEADERBOARD_LEVEL,
  MAX_LEADERBOARD_SCORE,
  normalizeLeaderboardDate,
  normalizeLeaderboardLevel,
  normalizeLeaderboardScore,
  normalizePlayerName,
  prepareLeaderboardEntries,
} from '../src/leaderboard/leaderboard.js';

describe('leaderboard data', () => {
  it('normalizes and limits player callsigns', () => {
    expect(normalizePlayerName('  Kuga   Pilot  ')).toBe('Kuga Pilot');
    expect(normalizePlayerName('12345678901234567')).toBe('1234567890123456');
  });

  it('normalizes leaderboard scores to safe non-negative integers', () => {
    expect(normalizeLeaderboardScore(42.9)).toBe(42);
    expect(normalizeLeaderboardScore(-5)).toBe(0);
    expect(normalizeLeaderboardScore('not-a-score')).toBe(0);
    expect(normalizeLeaderboardScore(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEADERBOARD_SCORE);
  });

  it('normalizes best levels and saved dates', () => {
    expect(normalizeLeaderboardLevel(12.8)).toBe(12);
    expect(normalizeLeaderboardLevel(0)).toBeNull();
    expect(normalizeLeaderboardLevel(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEADERBOARD_LEVEL);
    expect(normalizeLeaderboardDate('2026-08-03T12:00:00.000Z')).toBe('2026-08-03T12:00:00.000Z');
    expect(normalizeLeaderboardDate('not-a-date')).toBeNull();
  });

  it('sorts and limits the leaderboard to five entries', () => {
    const entries = prepareLeaderboardEntries([
      { id: 'f', displayName: 'Six', bestScore: 10 },
      {
        id: 'b',
        displayName: 'Beta',
        bestScore: 400,
        bestLevel: 7,
        updatedAt: { toDate: () => new Date('2026-08-03T12:00:00.000Z') },
      },
      { id: 'a', displayName: 'Alpha', bestScore: 400 },
      { id: 'c', displayName: 'Three', bestScore: 300 },
      { id: 'd', displayName: 'Four', bestScore: 200 },
      { id: 'e', displayName: 'Five', bestScore: 100 },
    ]);

    expect(entries).toHaveLength(5);
    expect(entries.find((entry) => entry.id === 'b')).toMatchObject({
      bestLevel: 7,
      savedAt: '2026-08-03T12:00:00.000Z',
    });
    expect(entries.map((entry) => entry.displayName)).toEqual([
      'Alpha', 'Beta', 'Three', 'Four', 'Five',
    ]);
  });
});

describe('Firebase configuration', () => {
  it('reports missing environment variables', () => {
    const result = getFirebaseConfiguration({ VITE_FIREBASE_API_KEY: 'key' });

    expect(result.isConfigured).toBe(false);
    expect(result.missing).toContain('VITE_FIREBASE_PROJECT_ID');
  });

  it('returns a complete Firebase web configuration', () => {
    const result = getFirebaseConfiguration({
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'example',
      VITE_FIREBASE_DATABASE_ID: 'leaderboard',
      VITE_FIREBASE_APP_ID: 'app-id',
    });

    expect(result).toEqual({
      config: {
        apiKey: 'key',
        authDomain: 'example.firebaseapp.com',
        projectId: 'example',
        databaseId: 'leaderboard',
        appId: 'app-id',
      },
      isConfigured: true,
      missing: [],
    });
  });
});
