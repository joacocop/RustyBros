import {
  Award,
  Check,
  Flag,
  LockKeyhole,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { useGameSession } from "../game/GameSession";
import { achievements } from "../game/progress";
import { clockLabel } from "../game/rules";

const statuses = {
  ready: "Por empezar",
  running: "En el sendero",
  paused: "En pausa",
  respawning: "Un respiro",
  lost: "Sin vidas",
  won: "Nivel completado",
};
export default function AchievementsPanel() {
  const { state, ready, syncing, error, native, client } = useGameSession();
  const latest = state.achievements.at(-1);
  const latestTitle = achievements.find(
    (item) => item.id === latest?.id,
  )?.title;
  return (
    <section
      className="panel achievements-panel"
      aria-label="Logros del juego"
      id="achievements"
    >
      <div className="panel-heading">
        <h2>
          <Trophy size={17} /> Tus saltos también cuentan
        </h2>
        <span className="preview-badge" data-achievement-count>
          {state.achievements.length} / {achievements.length} LOGROS
        </span>
      </div>
      <div className="achievements-summary">
        <div>
          <span className="eyebrow">DEL SENDERO AL EDITOR</span>
          <h3>Un corte, un salto, un logro.</h3>
          <p>
            El progreso de tus partidas se reúne acá. Los logros se conservan
            mientras la aplicación siga abierta.
          </p>
        </div>
        <div className="achievement-records">
          <span>
            Mejor puntaje
            <strong data-progress="best-score">
              {state.statistics.bestScore.toLocaleString("es-AR")}
            </strong>
          </span>
          <span>
            Victorias
            <strong data-progress="wins">{state.statistics.wins}</strong>
          </span>
          <span>
            Monedas recogidas
            <strong data-progress="total-coins">
              {state.statistics.collectedCoins}
            </strong>
          </span>
        </div>
      </div>
      <div className="shared-progress" aria-label="Progreso de la partida">
        <Flag size={15} />
        <strong data-progress="status">{statuses[state.status]}</strong>
        <span>Nivel {state.level}</span>
        <span>
          Puntaje <b data-progress="score">{state.score}</b>
        </span>
        <span>
          Vidas <b data-progress="lives">{state.lives}</b>
        </span>
        <span>
          Monedas <b data-progress="coins">{state.coins}</b>
        </span>
        <span>
          Tiempo <b data-progress="time">{clockLabel(state.timeLeft)}</b>
        </span>
        <small>
          {!native
            ? "Vista de navegador · esta sesión"
            : !ready
              ? "Conectando progreso…"
              : syncing
                ? "Guardando progreso…"
                : "Progreso al día"}
        </small>
      </div>
      {error && (
        <div className="progress-error" role="alert">
          <span>No se pudo sincronizar el progreso: {error}</span>
          <button className="secondary" onClick={() => void client.retry()}>
            <RefreshCw size={14} /> Reintentar conexión
          </button>
        </div>
      )}
      <div className="achievements-grid">
        {achievements.map((item) => {
          const unlocked = state.achievements.find(
            (value) => value.id === item.id,
          );
          return (
            <article
              key={item.id}
              className={`achievement ${unlocked ? "unlocked" : ""}`}
              data-achievement={item.id}
              data-unlocked={!!unlocked}
            >
              <span className="achievement-icon">
                {unlocked ? <Award size={23} /> : <LockKeyhole size={20} />}
              </span>
              <div>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
                <small>
                  {unlocked ? (
                    <>
                      <Check size={11} /> Desbloqueado
                    </>
                  ) : (
                    "Por descubrir"
                  )}
                </small>
              </div>
            </article>
          );
        })}
      </div>
      <p className="achievement-latest" role="status">
        {latestTitle
          ? `Último logro: ${latestTitle}.`
          : "Tu primera moneda es el comienzo. El próximo logro te espera en el sendero."}
      </p>
    </section>
  );
}
