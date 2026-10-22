import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { GameTransport, SharedGameState } from "./progress";

export const nativeGameTransport: GameTransport = {
  load: () => invoke<SharedGameState>("get_game_state"),
  update: (update) => invoke<SharedGameState>("update_game_state", { update }),
  listen: (receive) =>
    listen<SharedGameState>("game-progress", (event) => receive(event.payload)),
};
