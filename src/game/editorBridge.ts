import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parseEditorReward, type EditorReward } from "./rules";

export async function subscribeEditorRewards(
  receive: (reward: EditorReward) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const cleanups: (() => void)[] = [];
  try {
    for (const [event, kind] of [
      ["filter-applied", "effect"],
      ["video-exported", "export"],
    ] as const) {
      cleanups.push(
        await listen<unknown>(event, ({ payload }) => {
          const reward = parseEditorReward(kind, payload);
          if (reward) receive(reward);
        }),
      );
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  } catch (error) {
    cleanups.forEach((cleanup) => cleanup());
    throw error;
  }
}
