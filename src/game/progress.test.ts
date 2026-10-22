import { expect, it, vi } from "vitest";
import {
  browserProgress,
  emptySharedState,
  GameProgressClient,
  gameplayProgress,
  type GameTransport,
  type SharedGameState,
} from "./progress";
import { collectCoin, finishLevel, initialLevel, RewardLedger } from "./rules";

const running = (run = 1) => ({
  ...initialLevel(24, undefined, 0, "running"),
  run,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
};
function transport() {
  let receive!: (state: SharedGameState) => void;
  const cleanup = vi.fn();
  const api = {
    load: vi.fn(async () => emptySharedState()),
    update: vi.fn<GameTransport["update"]>(async () => emptySharedState()),
    listen: vi.fn<GameTransport["listen"]>(async (listener: typeof receive) => {
      receive = listener;
      return cleanup;
    }),
  };
  const client = new GameProgressClient(api);
  return {
    api,
    client,
    cleanup,
    emit: (state: SharedGameState) => receive(state),
  };
}

it("el navegador conserva logros y estadísticas al reiniciar, sin contar ticks duplicados", () => {
  let state = browserProgress(emptySharedState(), running());
  const collected = {
    ...running(),
    collectedCoins: 10,
    coins: 10,
    score: 1200,
    defeated: 1,
    checkpoint: true,
  };
  state = browserProgress(state, collected);
  state = browserProgress(state, collected);
  state = browserProgress(state, finishLevel(collected));
  state = browserProgress(state, finishLevel(collected));
  expect(state.achievements).toHaveLength(6);
  expect(state.statistics.wins).toBe(1);
  state = browserProgress(state, running(2));
  expect(state.statistics).toMatchObject({
    runsStarted: 2,
    collectedCoins: 10,
    defeated: 1,
    wins: 1,
  });
  expect(state.achievements).toHaveLength(6);
  expect(state.collectedCoins).toBe(0);
});

it("envía el puntaje del nivel separado de los premios del editor", () => {
  const ledger = new RewardLedger();
  ledger.accept({ id: "reward", kind: "export" });
  const state = collectCoin(initialLevel(24, ledger, 15, "running"));
  expect(state.score).toBe(600);
  expect(state.bonusScore).toBe(500);
  expect(gameplayProgress(state)).toMatchObject({
    gameplayScore: 100,
    collectedCoins: 1,
  });
});

it("registra el listener antes de leer y descarta respuestas con revisión antigua", async () => {
  const { client, api, emit, cleanup } = transport();
  const loading = deferred<SharedGameState>();
  api.load.mockReturnValue(loading.promise);
  const connected = client.connect();
  await vi.waitFor(() => expect(api.load).toHaveBeenCalledOnce());
  emit({ ...emptySharedState(), revision: 5, score: 500 });
  loading.resolve(emptySharedState());
  await connected;
  expect(client.getSnapshot().state.score).toBe(500);
  expect(client.getSnapshot().ready).toBe(true);
  client.disconnect();
  expect(cleanup).toHaveBeenCalledOnce();
});

it("limpia también un listener cuyo registro termina después de desmontar", async () => {
  const { client, api, cleanup } = transport();
  const registration = deferred<() => void>();
  api.listen.mockReturnValue(registration.promise);
  const connected = client.connect();
  client.disconnect();
  registration.resolve(cleanup);
  await connected;
  expect(cleanup).toHaveBeenCalledOnce();
  expect(api.load).not.toHaveBeenCalled();
});

it("agrupa ticks y retiene la victoria de una partida antes de iniciar la siguiente", async () => {
  const { client, api } = transport();
  await client.connect();
  const first = deferred<SharedGameState>();
  api.update.mockReturnValueOnce(first.promise);
  client.publish(running());
  client.publish(collectCoin(running()));
  client.publish(finishLevel(collectCoin(running())));
  client.publish(running(2));
  first.resolve(emptySharedState());
  await vi.waitFor(() => expect(client.getSnapshot().syncing).toBe(false));
  const calls = api.update.mock.calls.map(([update]) => update);
  const progress = calls.filter((update) => update.action === "progress");
  expect(calls.filter((update) => update.action === "startRun")).toHaveLength(
    2,
  );
  expect(progress.map((update) => update.progress.status)).toEqual([
    "running",
    "won",
    "running",
  ]);
  expect(progress[1].runId).toBe(progress[0].runId);
  expect(progress[2].runId).not.toBe(progress[0].runId);
});

it("conserva el progreso pendiente después de un fallo y permite reintentar", async () => {
  const { client, api } = transport();
  await client.connect();
  api.update.mockRejectedValueOnce(new Error("sin conexión"));
  client.publish(collectCoin(running()));
  await vi.waitFor(() =>
    expect(client.getSnapshot().error).toContain("sin conexión"),
  );
  client.publish({ ...running(), collectedCoins: 2, coins: 2, score: 200 });
  await client.retry();
  expect(client.getSnapshot().error).toBe("");
  const last = api.update.mock.calls.at(-1)![0];
  expect(last.action === "progress" && last.progress.collectedCoins).toBe(2);
});

it("confirma los premios aplicados y reenvía el escudo incluso en pausa", async () => {
  const { client, api, emit } = transport();
  await client.connect();
  client.publish({ ...running(), status: "paused" });
  await vi.waitFor(() => expect(client.getSnapshot().syncing).toBe(false));
  const receive = vi.fn();
  client.subscribeRewards(receive);
  emit({ ...emptySharedState(), revision: 10, rewardRevision: 1 });
  client.acknowledgeRewards(1);
  await vi.waitFor(() => expect(client.getSnapshot().syncing).toBe(false));
  expect(receive).toHaveBeenCalled();
  const last = api.update.mock.calls.at(-1)![0];
  expect(last.action === "progress" && last.acknowledgedRewardRevision).toBe(1);
});

it("libera una conexión parcial y permite recuperar la carga inicial", async () => {
  const { client, api, cleanup } = transport();
  api.load.mockRejectedValueOnce(new Error("error al leer"));
  await client.connect();
  expect(cleanup).toHaveBeenCalledOnce();
  expect(client.getSnapshot().ready).toBe(false);
  await client.retry();
  expect(client.getSnapshot().ready).toBe(true);
  expect(client.getSnapshot().error).toBe("");
});
