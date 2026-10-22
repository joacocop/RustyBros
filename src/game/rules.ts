export const STARTING_LIVES = 3;
export const LIFE_SECONDS = 180;
export const COIN_SCORE = 100;
export const ENEMY_SCORE = 200;
export type RewardKind = "effect" | "export";
export type EditorReward = { id: string; kind: RewardKind };
export type RewardGrant = EditorReward & {
  points: number;
  coins: number;
  shieldSeconds: number;
};
export type GameStatus =
  "ready" | "running" | "paused" | "respawning" | "lost" | "won";
export type DeathReason = "enemy" | "fall" | "timeout";
export type LevelState = {
  run: number;
  status: GameStatus;
  score: number;
  lives: number;
  coins: number;
  collectedCoins: number;
  bonusCoins: number;
  bonusScore: number;
  totalCoins: number;
  defeated: number;
  timeLeft: number;
  shieldSeconds: number;
  checkpoint: boolean;
  lastDeath: DeathReason | null;
  lastReward: RewardGrant | null;
};

const REWARDS = {
  effect: { points: 100, coins: 1, shieldSeconds: 8 },
  export: { points: 500, coins: 5, shieldSeconds: 15 },
} as const;

// The ledger survives level restarts, but is scoped to this application session.
export class RewardLedger {
  score = 0;
  coins = 0;
  lastReward: RewardGrant | null = null;
  private seen = new Set<string>();
  accept(reward: EditorReward): RewardGrant | null {
    if (!REWARDS[reward.kind] || !reward.id) return null;
    const key = `${reward.kind}:${reward.id}`;
    if (this.seen.has(key)) return null;
    this.seen.add(key);
    const grant = { ...reward, ...REWARDS[reward.kind] };
    this.score += grant.points;
    this.coins += grant.coins;
    this.lastReward = grant;
    return grant;
  }
}

export function initialLevel(
  totalCoins: number,
  rewards = new RewardLedger(),
  shieldSeconds = 0,
  status: GameStatus = "ready",
): LevelState {
  return {
    run: 0,
    status,
    score: rewards.score,
    lives: STARTING_LIVES,
    coins: rewards.coins,
    collectedCoins: 0,
    bonusCoins: rewards.coins,
    bonusScore: rewards.score,
    totalCoins,
    defeated: 0,
    timeLeft: LIFE_SECONDS,
    shieldSeconds,
    checkpoint: false,
    lastDeath: null,
    lastReward: rewards.lastReward,
  };
}
export function collectCoin(state: LevelState): LevelState {
  if (state.status !== "running" || state.collectedCoins >= state.totalCoins)
    return state;
  return {
    ...state,
    coins: state.coins + 1,
    collectedCoins: state.collectedCoins + 1,
    score: state.score + COIN_SCORE,
  };
}
export function defeatEnemy(state: LevelState): LevelState {
  return state.status === "running"
    ? {
        ...state,
        defeated: state.defeated + 1,
        score: state.score + ENEMY_SCORE,
      }
    : state;
}
export function grantReward(state: LevelState, grant: RewardGrant): LevelState {
  return {
    ...state,
    score: state.score + grant.points,
    coins: state.coins + grant.coins,
    bonusCoins: state.bonusCoins + grant.coins,
    bonusScore: state.bonusScore + grant.points,
    shieldSeconds: Math.max(state.shieldSeconds, grant.shieldSeconds),
    lastReward: grant,
  };
}
export function loseLife(state: LevelState, reason: DeathReason): LevelState {
  if (state.status !== "running") return state;
  const lives = Math.max(0, state.lives - 1);
  return {
    ...state,
    lives,
    status: lives > 0 ? "respawning" : "lost",
    shieldSeconds: 0,
    lastDeath: reason,
  };
}
export function resumeLife(state: LevelState): LevelState {
  return state.status === "respawning" && state.lives > 0
    ? { ...state, status: "running", timeLeft: LIFE_SECONDS, lastDeath: null }
    : state;
}
export function advanceClock(state: LevelState, seconds: number): LevelState {
  if (state.status !== "running" || !Number.isFinite(seconds) || seconds <= 0)
    return state;
  const next = {
    ...state,
    timeLeft: Math.max(0, state.timeLeft - seconds),
    shieldSeconds: Math.max(0, state.shieldSeconds - seconds),
  };
  return next.timeLeft === 0 ? loseLife(next, "timeout") : next;
}
export function finishLevel(state: LevelState): LevelState {
  return state.status === "running"
    ? {
        ...state,
        status: "won",
        score: state.score + 1000 + Math.ceil(state.timeLeft) * 5,
      }
    : state;
}
export function clockLabel(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
