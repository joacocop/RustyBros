import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mock.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mock.listen }));
import { nativeGameTransport } from "./editorBridge";
import { emptySharedState } from "./progress";

it("consulta y actualiza el estado a través de los commands de Rust", async () => {
  const state = emptySharedState();
  mock.invoke.mockResolvedValue(state);
  expect(await nativeGameTransport.load()).toBe(state);
  const update = { action: "startRun" as const, runId: "run" };
  expect(await nativeGameTransport.update(update)).toBe(state);
  expect(mock.invoke.mock.calls).toEqual([
    ["get_game_state"],
    ["update_game_state", { update }],
  ]);
});
it("lleva game-progress al editor y devuelve la limpieza del listener", async () => {
  const cleanup = vi.fn();
  const receive = vi.fn();
  mock.listen.mockResolvedValue(cleanup);
  expect(await nativeGameTransport.listen(receive)).toBe(cleanup);
  expect(mock.listen.mock.calls[0][0]).toBe("game-progress");
  const state = emptySharedState();
  mock.listen.mock.calls[0][1]({ payload: state });
  expect(receive).toHaveBeenCalledWith(state);
});
