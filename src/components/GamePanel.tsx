import { useEffect, useRef, useState } from "react";
import {
  Coins,
  Gamepad2,
  Heart,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Timer,
} from "lucide-react";
import { coinPositions, type LevelState } from "../game/level";
import { clockLabel, initialLevel } from "../game/rules";
import { useGameSession } from "../game/GameSession";
import { rewardSeed } from "../game/progress";

type Controller = ReturnType<typeof import("../game/createGame").createGame>;

export default function GamePanel() {
  const { client, ready, error: syncError } = useGameSession();
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<LevelState>(() =>
    initialLevel(coinPositions.length),
  );
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let cleanupRewards: (() => void) | undefined;
    import("../game/createGame")
      .then(({ createGame }) => {
        if (disposed || !host.current) return;
        const shared = client.getSnapshot().state;
        controller.current = createGame(
          host.current,
          (next) => {
            if (!disposed) {
              setLoaded(true);
              setState(next);
              client.publish(next);
            }
          },
          rewardSeed(shared),
        );
        client.acknowledgeRewards(shared.rewardRevision);
        cleanupRewards = client.subscribeRewards((snapshot) => {
          if (disposed) return;
          for (const reward of snapshot.rewards)
            controller.current?.reward(reward);
          client.acknowledgeRewards(snapshot.rewardRevision);
        });
      })
      .catch((e) => {
        if (!disposed) setError(String(e));
      });
    return () => {
      disposed = true;
      cleanupRewards?.();
      controller.current?.destroy();
      controller.current = null;
    };
  }, [client, ready]);

  return (
    <section
      id="game"
      className="panel game-panel"
      aria-label="Juego de plataformas"
    >
      <div className="panel-heading">
        <h2>
          <Gamepad2 size={17} /> Una pausa para jugar
        </h2>
        <span className="preview-badge">NIVEL 01 · EL SENDERO DEL ÓXIDO</span>
      </div>
      <div className="game-intro">
        <div>
          <h3>El próximo salto es tuyo.</h3>
          <p>
            Cada corte suma. Juntá monedas, vencé a los bichos y llegá a la
            bandera con tus tres vidas.
          </p>
        </div>
        <div className="game-stats">
          <span>
            Monedas del nivel{" "}
            <strong>
              {state.collectedCoins}/{state.totalCoins}
            </strong>
          </span>
          <span>
            Enemigos <strong>{state.defeated}/4</strong>
          </span>
        </div>
      </div>
      <div className="reward-strip" aria-live="polite">
        <Shield size={15} />
        {state.lastReward ? (
          <span>
            <strong>
              {state.lastReward.kind === "effect"
                ? "Efectos aplicados"
                : "Video exportado"}
            </strong>{" "}
            · +{state.lastReward.points} puntos · +{state.lastReward.coins}{" "}
            moneda{state.lastReward.coins > 1 ? "s" : ""} · escudo de{" "}
            {state.lastReward.shieldSeconds} s de juego
          </span>
        ) : (
          <span>
            Aplicá efectos: +100 puntos, +1 moneda y escudo. Exportá: +500
            puntos, +5 monedas y escudo.
          </span>
        )}
      </div>
      {syncError && (
        <p className="game-bridge-error" role="alert">
          El progreso está pendiente de sincronizar. Usá «Reintentar conexión»
          en el panel de logros.
        </p>
      )}
      <div className="game-stage">
        <div
          ref={host}
          className="game-host"
          data-game
          tabIndex={0}
          role="application"
          aria-label="Nivel 1. Flechas o A y D para caminar; espacio, W o flecha arriba para saltar. P para pausar. R para reiniciar."
        />
        <div className="game-hud" role="group" aria-label="HUD del juego">
          <div>
            <span>PUNTAJE</span>
            <strong data-hud="score">
              {state.score.toString().padStart(6, "0")}
            </strong>
          </div>
          <div>
            <span>
              <Heart size={12} /> VIDAS
            </span>
            <strong data-hud="lives">
              {state.lives}
              <small aria-hidden="true">
                {"♥".repeat(state.lives)}
                {"♡".repeat(3 - state.lives)}
              </small>
            </strong>
          </div>
          <div>
            <span>
              <Coins size={12} /> MONEDAS
            </span>
            <strong data-hud="coins">
              {state.coins}
              <small>+{state.bonusCoins} del editor</small>
            </strong>
          </div>
          <div className={state.timeLeft <= 30 ? "time-low" : ""}>
            <span>
              <Timer size={12} /> TIEMPO
            </span>
            <strong data-hud="time">{clockLabel(state.timeLeft)}</strong>
          </div>
          <div
            className={`hud-shield ${state.shieldSeconds > 0 ? "active" : ""}`}
          >
            <span>
              <Shield size={12} /> ESCUDO
            </span>
            <strong data-hud="shield">
              {state.shieldSeconds > 0
                ? `${Math.ceil(state.shieldSeconds)} s`
                : "—"}
            </strong>
          </div>
        </div>
        {(!loaded || state.status !== "running") && (
          <div className="game-overlay">
            {!loaded && !error && !syncError ? (
              <LoaderCircle className="spin" size={28} />
            ) : (
              <Gamepad2 size={30} />
            )}
            <h3>
              {syncError && !ready
                ? "No se pudo conectar el juego"
                : error
                  ? "No se pudo cargar el juego"
                  : !loaded
                    ? "Preparando el sendero…"
                    : state.status === "won"
                      ? "¡Llegaste al último corte!"
                      : state.status === "respawning"
                        ? `Un respiro. Te quedan ${state.lives} vidas.`
                        : state.status === "lost"
                          ? "Sin vidas. Una nueva aventura."
                          : state.status === "paused"
                            ? "El sendero te espera."
                            : "Una pequeña aventura entre cortes."}
            </h3>
            <p>
              {error ||
                (!ready && syncError
                  ? "Reintentá la conexión desde el panel de logros para continuar."
                  : "") ||
                (state.status === "won"
                  ? `${state.score} puntos · ${state.collectedCoins}/${state.totalCoins} monedas del nivel · ${state.defeated} enemigos vencidos.`
                  : state.status === "respawning"
                    ? `${state.lastDeath === "timeout" ? "Se terminó el tiempo." : state.lastDeath === "fall" ? "Cuidado con los pozos." : "Probá saltar sobre el enemigo."} Vas a reaparecer ${state.checkpoint ? "en la posta intermedia" : "al comienzo"}, con tres minutos.`
                    : state.status === "lost"
                      ? "Reiniciá el nivel con tres vidas. Tus recompensas de edición se conservan durante esta sesión."
                      : "Flechas o A / D para moverte · Espacio, W o ↑ para saltar.")}
            </p>
            {loaded && !error && (
              <button
                className="primary"
                onClick={() =>
                  state.status === "respawning"
                    ? controller.current?.respawn()
                    : state.status === "won" || state.status === "lost"
                      ? controller.current?.restart()
                      : controller.current?.play()
                }
              >
                <Play size={16} />
                {state.status === "respawning"
                  ? "Reaparecer"
                  : state.status === "won" || state.status === "lost"
                    ? "Volver a jugar"
                    : state.status === "paused"
                      ? "Continuar"
                      : "Empezar aventura"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="game-controls">
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> moverte <kbd>Espacio</kbd> saltar <kbd>P</kbd> pausa{" "}
          <kbd>R</kbd> reiniciar
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Pausar juego"
            disabled={!loaded || state.status !== "running"}
            onClick={() => controller.current?.pause()}
          >
            <Pause size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Reiniciar nivel"
            disabled={!loaded}
            onClick={() => controller.current?.restart()}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
