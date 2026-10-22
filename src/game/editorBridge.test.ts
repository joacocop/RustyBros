import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ native: true, listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => mock.native }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mock.listen }));
import { subscribeEditorRewards } from "./editorBridge";

beforeEach(() => {
  mock.native = true;
  mock.listen.mockReset();
});
it("conecta ambos eventos y libera sus listeners al cerrar el juego", async () => {
  const first = vi.fn(),
    second = vi.fn();
  const receive = vi.fn();
  mock.listen.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const cleanup = await subscribeEditorRewards(receive);
  expect(mock.listen.mock.calls.map((call) => call[0])).toEqual([
    "filter-applied",
    "video-exported",
  ]);
  mock.listen.mock.calls[0][1]({
    payload: {
      id: "6fba8292-c3c7-4e3c-8dbd-0bcd71acb743",
      duration: 1,
      effectsCount: 1,
    },
  });
  mock.listen.mock.calls[0][1]({ payload: { id: "incorrecto", duration: 1 } });
  expect(receive).toHaveBeenCalledTimes(1);
  cleanup();
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
});
it("limpia una conexión parcial si falla el segundo listener", async () => {
  const first = vi.fn();
  mock.listen
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error("sin conexión"));
  await expect(subscribeEditorRewards(vi.fn())).rejects.toThrow("sin conexión");
  expect(first).toHaveBeenCalledOnce();
});
it("mantiene el juego disponible en navegador sin invocar IPC", async () => {
  mock.native = false;
  const cleanup = await subscribeEditorRewards(vi.fn());
  cleanup();
  expect(mock.listen).not.toHaveBeenCalled();
});
