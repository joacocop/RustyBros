import type {
  EditorReward,
  GameStatus,
  LevelState,
  RewardGrant,
} from "./rules";

export const achievements = [
  {
    id: "first-coin",
    title: "Primer brillo",
    description: "Recogé tu primera moneda del nivel.",
  },
  {
    id: "collector",
    title: "Ojo de coleccionista",
    description: "Recogé 10 monedas entre tus partidas.",
  },
  {
    id: "first-enemy",
    title: "Un salto preciso",
    description: "Vencé a tu primer enemigo.",
  },
  {
    id: "checkpoint",
    title: "A mitad de camino",
    description: "Activá la posta intermedia.",
  },
  {
    id: "first-win",
    title: "El último corte",
    description: "Llegá a la bandera del sendero.",
  },
  {
    id: "flawless",
    title: "Sin un rasguño",
    description: "Completá el nivel con las tres vidas.",
  },
] as const;

export type AchievementId = (typeof achievements)[number]["id"];
export type SharedReward = RewardGrant & { revision: number };
export type SharedGameState = {
  revision: number;
  runId: string | null;
  sequence: number;
  score: number;
  level: number;
  lives: number;
  coins: number;
  collectedCoins: number;
  defeated: number;
  timeLeft: number;
  shieldSeconds: number;
  checkpoint: boolean;
  status: GameStatus;
  bonusScore: number;
  bonusCoins: number;
  rewardRevision: number;
  rewards: SharedReward[];
  achievements: { id: AchievementId; unlockedAt: number }[];
  statistics: {
    runsStarted: number;
    wins: number;
    collectedCoins: number;
    defeated: number;
    bestScore: number;
  };
};
export type GameplayProgress = Pick<
  LevelState,
  | "lives"
  | "collectedCoins"
  | "defeated"
  | "timeLeft"
  | "shieldSeconds"
  | "checkpoint"
  | "status"
> & { gameplayScore: number; level: number };
export type GameUpdate =
  | { action: "startRun"; runId: string }
  | {
      action: "progress";
      runId: string;
      sequence: number;
      acknowledgedRewardRevision: number;
      progress: GameplayProgress;
    };

export function emptySharedState(): SharedGameState {
  return {
    revision: 0,
    runId: null,
    sequence: 0,
    score: 0,
    level: 1,
    lives: 3,
    coins: 0,
    collectedCoins: 0,
    defeated: 0,
    timeLeft: 180,
    shieldSeconds: 0,
    checkpoint: false,
    status: "ready",
    bonusScore: 0,
    bonusCoins: 0,
    rewardRevision: 0,
    rewards: [],
    achievements: [],
    statistics: {
      runsStarted: 0,
      wins: 0,
      collectedCoins: 0,
      defeated: 0,
      bestScore: 0,
    },
  };
}

export function gameplayProgress(state: LevelState): GameplayProgress {
  return {
    gameplayScore: state.score - state.bonusScore,
    level: 1,
    lives: state.lives,
    collectedCoins: state.collectedCoins,
    defeated: state.defeated,
    timeLeft: state.timeLeft,
    shieldSeconds: state.shieldSeconds,
    checkpoint: state.checkpoint,
    status: state.status,
  };
}

// Browser preview only. The desktop uses the Rust store and its game-progress events.
export function browserProgress(
  previous: SharedGameState,
  state: LevelState,
): SharedGameState {
  const newRun = previous.runId !== String(state.run);
  const statistics = {
    runsStarted: previous.statistics.runsStarted + Number(newRun),
    collectedCoins:
      previous.statistics.collectedCoins +
      state.collectedCoins -
      (newRun ? 0 : previous.collectedCoins),
    defeated:
      previous.statistics.defeated +
      state.defeated -
      (newRun ? 0 : previous.defeated),
    wins:
      previous.statistics.wins +
      Number(state.status === "won" && (newRun || previous.status !== "won")),
    bestScore: Math.max(previous.statistics.bestScore, state.score),
  };
  const unlocked = [...previous.achievements];
  const unlock = (id: AchievementId, condition: boolean) => {
    if (condition && !unlocked.some((item) => item.id === id))
      unlocked.push({ id, unlockedAt: Date.now() });
  };
  unlock("first-coin", statistics.collectedCoins >= 1);
  unlock("collector", statistics.collectedCoins >= 10);
  unlock("first-enemy", statistics.defeated >= 1);
  unlock("checkpoint", state.checkpoint);
  unlock("first-win", state.status === "won");
  unlock("flawless", state.status === "won" && state.lives === 3);
  return {
    ...previous,
    ...gameplayProgress(state),
    score: state.score,
    coins: state.coins,
    bonusScore: state.bonusScore,
    bonusCoins: state.bonusCoins,
    runId: String(state.run),
    revision: previous.revision + 1,
    statistics,
    achievements: unlocked,
  };
}

export type GameTransport = {
  load: () => Promise<SharedGameState>;
  update: (update: GameUpdate) => Promise<SharedGameState>;
  listen: (receive: (state: SharedGameState) => void) => Promise<() => void>;
};
type View = {
  state: SharedGameState;
  ready: boolean;
  syncing: boolean;
  error: string;
  native: boolean;
};
type Pending = {
  localRun: number;
  runId: string;
  progress: GameplayProgress;
  acknowledgedRewardRevision: number;
};

export class GameProgressClient {
  private view: View;
  private listeners = new Set<() => void>();
  private rewardListeners = new Set<(state: SharedGameState) => void>();
  private unlisten?: () => void;
  private connecting?: Promise<void>;
  private generation = 0;
  private pending: Pending[] = [];
  private activeRun?: string;
  private localRun?: number;
  private runId = "";
  private sequence = 0;
  private acknowledged = 0;
  private sending = false;
  private latest?: LevelState;
  constructor(private transport?: GameTransport) {
    this.view = {
      state: emptySharedState(),
      ready: !transport,
      syncing: false,
      error: "",
      native: !!transport,
    };
  }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  subscribeRewards = (listener: (state: SharedGameState) => void) => {
    this.rewardListeners.add(listener);
    return () => {
      this.rewardListeners.delete(listener);
    };
  };
  acknowledgeRewards(revision: number) {
    if (revision <= this.acknowledged) return;
    this.acknowledged = revision;
    if (this.latest) this.publish(this.latest);
  }
  private patch(patch: Partial<View>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private receive = (state: SharedGameState) => {
    if (state.revision < this.view.state.revision) return;
    this.patch({ state });
    this.rewardListeners.forEach((listener) => listener(state));
  };
  connect = (): Promise<void> => {
    if (!this.transport || this.unlisten) return Promise.resolve();
    if (this.connecting) return this.connecting;
    const generation = this.generation;
    this.connecting = (async () => {
      try {
        const cleanup = await this.transport!.listen((state) => {
          if (generation === this.generation) this.receive(state);
        });
        if (generation !== this.generation) {
          cleanup();
          return;
        }
        this.unlisten = cleanup;
        const state = await this.transport!.load();
        if (generation !== this.generation) return;
        this.receive(state);
        this.patch({ ready: true, error: "" });
      } catch (error) {
        if (generation === this.generation) {
          this.unlisten?.();
          this.unlisten = undefined;
          this.patch({ error: String(error) });
        }
      } finally {
        if (generation === this.generation) this.connecting = undefined;
      }
    })();
    return this.connecting;
  };
  disconnect = () => {
    this.generation++;
    this.unlisten?.();
    this.unlisten = undefined;
    this.connecting = undefined;
  };
  publish = (state: LevelState) => {
    this.latest = { ...state };
    if (!this.transport) {
      this.receive(browserProgress(this.view.state, state));
      return;
    }
    if (this.localRun !== state.run) {
      this.localRun = state.run;
      this.runId = crypto.randomUUID();
    }
    const job = {
      localRun: state.run,
      runId: this.runId,
      progress: gameplayProgress(state),
      acknowledgedRewardRevision: this.acknowledged,
    };
    // Coalesce ticks within a run, retaining the final snapshot before each restart.
    if (this.pending.at(-1)?.localRun === state.run)
      this.pending[this.pending.length - 1] = job;
    else this.pending.push(job);
    void this.flush();
  };
  retry = async () => {
    if (!this.view.ready) {
      await this.connect();
      return;
    }
    try {
      if (this.transport) this.receive(await this.transport.load());
      this.patch({ error: "" });
      await this.flush();
    } catch (error) {
      this.patch({ error: String(error) });
    }
  };
  private async flush() {
    if (!this.transport || this.sending || this.view.error || !this.view.ready)
      return;
    const generation = this.generation;
    this.sending = true;
    this.patch({ syncing: true });
    try {
      while (this.pending.length && generation === this.generation) {
        const job = this.pending[0];
        if (this.activeRun !== job.runId) {
          const state = await this.transport.update({
            action: "startRun",
            runId: job.runId,
          });
          if (generation !== this.generation) return;
          this.activeRun = job.runId;
          this.sequence = 0;
          this.receive(state);
        }
        const state = await this.transport.update({
          action: "progress",
          runId: job.runId,
          sequence: ++this.sequence,
          acknowledgedRewardRevision: job.acknowledgedRewardRevision,
          progress: job.progress,
        });
        if (generation !== this.generation) return;
        if (this.pending[0] === job) this.pending.shift();
        this.receive(state);
      }
    } catch (error) {
      if (generation === this.generation) this.patch({ error: String(error) });
    } finally {
      this.sending = false;
      if (generation === this.generation) this.patch({ syncing: false });
    }
  }
}

export function rewardSeed(state: SharedGameState): {
  rewards: EditorReward[];
  shieldSeconds: number;
} {
  return { rewards: state.rewards, shieldSeconds: state.shieldSeconds };
}
