import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore/lite';
import {
  LEADERBOARD_LIMIT,
  normalizeLeaderboardLevel,
  normalizeLeaderboardScore,
  normalizePlayerName,
  prepareLeaderboardEntries,
} from './leaderboard.js';

export async function createFirebaseLeaderboardService(config) {
  const { databaseId, ...firebaseConfig } = config;
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getFirestore(app, databaseId);
  const scores = collection(database, 'leaderboard');

  async function getPlayer() {
    if (auth.currentUser) return auth.currentUser;
    const credential = await signInAnonymously(auth);
    return credential.user;
  }

  async function listTopScores() {
    const topScoresQuery = query(
      scores,
      orderBy('bestScore', 'desc'),
      limit(LEADERBOARD_LIMIT),
    );
    const snapshot = await getDocs(topScoresQuery);
    return prepareLeaderboardEntries(
      snapshot.docs.map((scoreDocument) => ({
        id: scoreDocument.id,
        ...scoreDocument.data(),
      })),
    );
  }

  async function saveBestScore(displayNameValue, bestScoreValue, bestLevelValue) {
    const displayName = normalizePlayerName(displayNameValue);
    const bestScore = normalizeLeaderboardScore(bestScoreValue);
    const bestLevel = normalizeLeaderboardLevel(bestLevelValue);
    if (!displayName) throw new Error('A callsign is required.');
    if (bestScore <= 0) throw new Error('Play a mission before saving a score.');

    const player = await getPlayer();
    const playerScore = doc(scores, player.uid);
    const existingSnapshot = await getDoc(playerScore);
    const existingData = existingSnapshot.exists() ? existingSnapshot.data() : {};
    const existingBest = normalizeLeaderboardScore(existingData.bestScore);
    const existingLevel = normalizeLeaderboardLevel(existingData.bestLevel);
    const savedBestScore = Math.max(bestScore, existingBest);
    const shouldUpdateLevel = (
      bestScore > existingBest
      || (bestScore === existingBest && (bestLevel || 0) > (existingLevel || 0))
    );
    const savedBestLevel = shouldUpdateLevel ? bestLevel : existingLevel;

    await setDoc(playerScore, {
      displayName,
      bestScore: savedBestScore,
      bestLevel: savedBestLevel,
      updatedAt: serverTimestamp(),
    });

    return { displayName, bestScore: savedBestScore, bestLevel: savedBestLevel };
  }

  return { listTopScores, saveBestScore };
}
