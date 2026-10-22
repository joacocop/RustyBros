import { describe, expect, it } from "vitest";
import {
  advanceClock,
  collectCoin,
  defeatEnemy,
  finishLevel,
  grantReward,
  initialLevel,
  loseLife,
  resumeLife,
  RewardLedger,
  clockLabel,
} from "./rules";

const id = "6fba8292-c3c7-4e3c-8dbd-0bcd71acb743";
const running = () => initialLevel(24, undefined, 0, "running");

describe("vidas y reloj", () => {
  it("pierde una sola vida por incidente y termina al agotar las tres", () => {
    let state = loseLife(running(), "fall");
    expect(state.lives).toBe(2);
    expect(state.status).toBe("respawning");
    expect(loseLife(state, "enemy")).toBe(state);
    state = loseLife(resumeLife(state), "enemy");
    expect(state.lives).toBe(1);
    state = loseLife(resumeLife(state), "timeout");
    expect(state.status).toBe("lost");
    expect(state.lives).toBe(0);
    expect(resumeLife(state)).toBe(state);
  });
  it("congela el tiempo y el escudo fuera de la partida activa", () => {
    const state = { ...running(), timeLeft: 20, shieldSeconds: 8 };
    const next = advanceClock(state, 2.5);
    expect(next.timeLeft).toBe(17.5);
    expect(next.shieldSeconds).toBe(5.5);
    for (const status of [
      "ready",
      "paused",
      "respawning",
      "won",
      "lost",
    ] as const) {
      const frozen = { ...state, status };
      expect(advanceClock(frozen, 50)).toBe(frozen);
    }
    expect(advanceClock(state, NaN)).toBe(state);
  });
  it("agota el reloj una vez, sin tiempos negativos, y renueva el tiempo al reaparecer", () => {
    const state = advanceClock({ ...running(), timeLeft: 0.1 }, 1);
    expect(state).toMatchObject({
      timeLeft: 0,
      lives: 2,
      status: "respawning",
      lastDeath: "timeout",
    });
    expect(advanceClock(state, 10)).toBe(state);
    expect(resumeLife(state).timeLeft).toBe(180);
    expect(clockLabel(59.1)).toBe("01:00");
    expect(clockLabel(-1)).toBe("00:00");
  });
});

describe("puntaje y recompensas de edición", () => {
  it("suma puntaje por monedas, enemigos y victoria una sola vez", () => {
    let state = collectCoin(running());
    state = defeatEnemy(state);
    expect(state).toMatchObject({
      score: 300,
      coins: 1,
      collectedCoins: 1,
      defeated: 1,
    });
    state = finishLevel(state);
    expect(state.score).toBe(2200);
    expect(finishLevel(state)).toBe(state);
    expect(collectCoin(state)).toBe(state);
  });
  it("acredita cada operación exitosa una vez y conserva solo los bonos al reiniciar", () => {
    const ledger = new RewardLedger();
    const effect = ledger.accept({ id, kind: "effect" })!;
    const rewarded = grantReward(collectCoin(running()), effect);
    expect(rewarded).toMatchObject({
      score: 200,
      coins: 2,
      bonusCoins: 1,
      collectedCoins: 1,
      shieldSeconds: 8,
    });
    expect(ledger.accept({ id, kind: "effect" })).toBeNull();
    const exported = ledger.accept({ id, kind: "export" })!;
    expect(grantReward(rewarded, exported)).toMatchObject({
      score: 700,
      coins: 7,
      shieldSeconds: 15,
    });
    expect(initialLevel(24, ledger)).toMatchObject({
      score: 600,
      coins: 6,
      collectedCoins: 0,
      lives: 3,
    });
  });
  it("permite recibir premios en pausa sin empezar el juego ni acortar el escudo", () => {
    const grant = new RewardLedger().accept({ id, kind: "effect" })!;
    const next = grantReward(
      { ...running(), status: "paused", shieldSeconds: 12 },
      grant,
    );
    expect(next.status).toBe("paused");
    expect(next.shieldSeconds).toBe(12);
  });
});
