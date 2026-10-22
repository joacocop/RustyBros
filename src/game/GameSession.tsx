import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { GameProgressClient } from "./progress";
import { nativeGameTransport } from "./editorBridge";

const Session = createContext<GameProgressClient | null>(null);
export function GameSessionProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new GameProgressClient(isTauri() ? nativeGameTransport : undefined),
  );
  useEffect(() => {
    void client.connect();
    return client.disconnect;
  }, [client]);
  return <Session.Provider value={client}>{children}</Session.Provider>;
}
export function useGameSession() {
  const client = useContext(Session);
  if (!client) throw new Error("Falta la sesión del juego.");
  const view = useSyncExternalStore(client.subscribe, client.getSnapshot);
  return { client, ...view };
}
