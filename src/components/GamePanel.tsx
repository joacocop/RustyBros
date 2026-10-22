import { useEffect, useRef, useState } from "react";
import { Gamepad2, LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import { coinPositions, type LevelState } from "../game/level";

type Controller = ReturnType<typeof import("../game/createGame").createGame>;

export default function GamePanel() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<LevelState>({
    status: "ready",
    coins: 0,
    totalCoins: coinPositions.length,
    defeated: 0,
  });
  useEffect(() => {
    let disposed = false;
    import("../game/createGame")
      .then(({ createGame }) => {
        if (disposed || !host.current) return;
        controller.current = createGame(host.current, (next) => {
          if (!disposed) {
            setLoaded(true);
            setState(next);
          }
        });
      })
      .catch((e) => {
        if (!disposed) setError(String(e));
      });
    return () => {
      disposed = true;
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

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
            Juntá monedas, saltá sobre los bichos y llegá a la bandera. Tu
            exportación sigue en marcha.
          </p>
        </div>
        <div className="game-stats">
          <span>
            Monedas{" "}
            <strong>
              {state.coins}/{state.totalCoins}
            </strong>
          </span>
          <span>
            Enemigos <strong>{state.defeated}/4</strong>
          </span>
        </div>
      </div>
      <div className="game-stage">
        <div
          ref={host}
          className="game-host"
          data-game
          tabIndex={0}
          role="application"
          aria-label="Nivel 1. Flechas o A y D para caminar; espacio, W o flecha arriba para saltar. P para pausar. R para reiniciar."
        />
        {(!loaded || state.status !== "running") && (
          <div className="game-overlay">
            {!loaded && !error ? (
              <LoaderCircle className="spin" size={28} />
            ) : (
              <Gamepad2 size={30} />
            )}
            <h3>
              {error
                ? "No se pudo cargar el juego"
                : !loaded
                  ? "Preparando el sendero…"
                  : state.status === "won"
                    ? "¡Llegaste al último corte!"
                    : state.status === "lost"
                      ? "Un salto más. Un nuevo intento."
                      : state.status === "paused"
                        ? "El sendero te espera."
                        : "Una pequeña aventura entre cortes."}
            </h3>
            <p>
              {error ||
                (state.status === "won"
                  ? `Conseguiste ${state.coins} de ${state.totalCoins} monedas y venciste a ${state.defeated} enemigos.`
                  : state.status === "lost"
                    ? "Evitá los pozos y los enemigos. Saltá sobre ellos para vencerlos."
                    : "Flechas o A / D para moverte · Espacio, W o ↑ para saltar.")}
            </p>
            {loaded && !error && (
              <button
                className="primary"
                onClick={() =>
                  state.status === "won" || state.status === "lost"
                    ? controller.current?.restart()
                    : controller.current?.play()
                }
              >
                <Play size={16} />
                {state.status === "won" || state.status === "lost"
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
