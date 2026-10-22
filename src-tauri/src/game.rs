use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Emitter;

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GameStatus {
    #[default]
    Ready,
    Running,
    Paused,
    Respawning,
    Lost,
    Won,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RewardKind {
    Effect,
    Export,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reward {
    pub id: String,
    pub kind: RewardKind,
    pub points: u32,
    pub coins: u32,
    pub shield_seconds: f64,
    pub revision: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub id: String,
    pub unlocked_at: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Statistics {
    pub runs_started: u32,
    pub wins: u32,
    pub collected_coins: u32,
    pub defeated: u32,
    pub best_score: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    pub revision: u64,
    pub run_id: Option<String>,
    pub sequence: u64,
    pub score: u32,
    pub level: u8,
    pub lives: u8,
    pub coins: u32,
    pub collected_coins: u32,
    pub defeated: u32,
    pub time_left: f64,
    pub shield_seconds: f64,
    pub checkpoint: bool,
    pub status: GameStatus,
    pub bonus_score: u32,
    pub bonus_coins: u32,
    pub reward_revision: u64,
    pub rewards: Vec<Reward>,
    pub achievements: Vec<Achievement>,
    pub statistics: Statistics,
    #[serde(skip)]
    seen_runs: HashSet<String>,
    #[serde(skip)]
    seen_rewards: HashSet<String>,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            revision: 0,
            run_id: None,
            sequence: 0,
            score: 0,
            level: 1,
            lives: 3,
            coins: 0,
            collected_coins: 0,
            defeated: 0,
            time_left: 180.0,
            shield_seconds: 0.0,
            checkpoint: false,
            status: GameStatus::Ready,
            bonus_score: 0,
            bonus_coins: 0,
            reward_revision: 0,
            rewards: vec![],
            achievements: vec![],
            statistics: Statistics::default(),
            seen_runs: HashSet::new(),
            seen_rewards: HashSet::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameProgress {
    pub gameplay_score: u32,
    pub level: u8,
    pub lives: u8,
    pub collected_coins: u32,
    pub defeated: u32,
    pub time_left: f64,
    pub shield_seconds: f64,
    pub checkpoint: bool,
    pub status: GameStatus,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum GameUpdate {
    StartRun {
        run_id: String,
    },
    Progress {
        run_id: String,
        sequence: u64,
        acknowledged_reward_revision: u64,
        progress: GameProgress,
    },
}

impl GameState {
    fn unlock(&mut self, id: &str) {
        if self.achievements.iter().any(|item| item.id == id) {
            return;
        }
        let unlocked_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.achievements.push(Achievement {
            id: id.into(),
            unlocked_at,
        });
    }

    pub fn reward(&mut self, id: &str, kind: RewardKind) -> bool {
        let key = format!("{kind:?}:{id}");
        if !self.seen_rewards.insert(key) {
            return false;
        }
        let (points, coins, shield_seconds) = match kind {
            RewardKind::Effect => (100, 1, 8.0),
            RewardKind::Export => (500, 5, 15.0),
        };
        self.reward_revision += 1;
        self.bonus_score += points;
        self.score += points;
        self.bonus_coins += coins;
        self.coins += coins;
        self.shield_seconds = self.shield_seconds.max(shield_seconds);
        self.rewards.push(Reward {
            id: id.into(),
            kind,
            points,
            coins,
            shield_seconds,
            revision: self.reward_revision,
        });
        self.statistics.best_score = self.statistics.best_score.max(self.score);
        self.revision += 1;
        true
    }

    pub fn update(&mut self, update: GameUpdate) -> Result<bool, String> {
        match update {
            GameUpdate::StartRun { run_id } => {
                uuid::Uuid::parse_str(&run_id).map_err(|_| "Identificador de partida inválido.")?;
                if self.run_id.as_ref() == Some(&run_id) {
                    return Ok(false);
                }
                if !self.seen_runs.insert(run_id.clone()) {
                    return Err("La partida ya terminó; actualizá la conexión.".into());
                }
                self.run_id = Some(run_id);
                self.sequence = 0;
                self.score = self.bonus_score;
                self.coins = self.bonus_coins;
                self.collected_coins = 0;
                self.defeated = 0;
                self.lives = 3;
                self.time_left = 180.0;
                self.checkpoint = false;
                self.status = GameStatus::Ready;
                self.statistics.runs_started += 1;
            }
            GameUpdate::Progress {
                run_id,
                sequence,
                acknowledged_reward_revision,
                progress: p,
            } => {
                if self.run_id.as_ref() != Some(&run_id) {
                    return Err("El progreso pertenece a otra partida.".into());
                }
                if sequence <= self.sequence {
                    return Ok(false);
                }
                if acknowledged_reward_revision > self.reward_revision
                    || p.level != 1
                    || p.lives > 3
                    || p.collected_coins > 24
                    || p.defeated > 4
                    || !p.time_left.is_finite()
                    || !(0.0..=180.0).contains(&p.time_left)
                    || !p.shield_seconds.is_finite()
                    || !(0.0..=15.0).contains(&p.shield_seconds)
                    || p.collected_coins < self.collected_coins
                    || p.defeated < self.defeated
                    || p.lives > self.lives
                    || (p.status == GameStatus::Lost) != (p.lives == 0)
                    || (p.status == GameStatus::Respawning && p.lives >= 3)
                    || (self.status == GameStatus::Won && p.status != GameStatus::Won)
                {
                    return Err("El progreso del juego no es válido.".into());
                }
                let base = p.collected_coins * 100 + p.defeated * 200;
                let expected = if p.status == GameStatus::Won {
                    base + 1000 + p.time_left.ceil() as u32 * 5
                } else {
                    base
                };
                if p.gameplay_score != expected {
                    return Err("El puntaje no coincide con el progreso del nivel.".into());
                }
                self.statistics.collected_coins += p.collected_coins - self.collected_coins;
                self.statistics.defeated += p.defeated - self.defeated;
                if p.status == GameStatus::Won && self.status != GameStatus::Won {
                    self.statistics.wins += 1;
                }
                // Gameplay snapshots never replace the wallet written by the video workers.
                self.score = p.gameplay_score + self.bonus_score;
                self.coins = p.collected_coins + self.bonus_coins;
                let pending_shield = self
                    .rewards
                    .iter()
                    .filter(|reward| reward.revision > acknowledged_reward_revision)
                    .map(|reward| reward.shield_seconds)
                    .fold(0.0, f64::max);
                self.shield_seconds = p.shield_seconds.max(pending_shield);
                self.collected_coins = p.collected_coins;
                self.defeated = p.defeated;
                self.lives = p.lives;
                self.time_left = p.time_left;
                self.checkpoint |= p.checkpoint;
                self.status = p.status;
                self.sequence = sequence;
                self.statistics.best_score = self.statistics.best_score.max(self.score);
                if self.statistics.collected_coins >= 1 {
                    self.unlock("first-coin");
                }
                if self.statistics.collected_coins >= 10 {
                    self.unlock("collector");
                }
                if self.statistics.defeated >= 1 {
                    self.unlock("first-enemy");
                }
                if self.checkpoint {
                    self.unlock("checkpoint");
                }
                if self.status == GameStatus::Won {
                    self.unlock("first-win");
                    if self.lives == 3 {
                        self.unlock("flawless");
                    }
                }
            }
        }
        self.revision += 1;
        Ok(true)
    }
}

#[derive(Default)]
pub struct GameStateStore(pub Mutex<GameState>);

impl GameStateStore {
    pub fn get(&self) -> Result<GameState, String> {
        self.0
            .lock()
            .map(|state| state.clone())
            .map_err(|_| "No se pudo leer el progreso del juego.".into())
    }
    pub fn update(&self, update: GameUpdate) -> Result<(GameState, bool), String> {
        let mut state = self
            .0
            .lock()
            .map_err(|_| "No se pudo actualizar el progreso del juego.")?;
        let changed = state.update(update)?;
        Ok((state.clone(), changed))
    }
    pub fn reward(&self, id: &str, kind: RewardKind) -> Result<(GameState, bool), String> {
        let mut state = self
            .0
            .lock()
            .map_err(|_| "No se pudo guardar la recompensa del editor.")?;
        let changed = state.reward(id, kind);
        Ok((state.clone(), changed))
    }
}

pub fn emit_progress(app: &tauri::AppHandle, state: &GameState) {
    let _ = app.emit_to("main", "game-progress", state);
}

#[tauri::command]
pub fn get_game_state(state: tauri::State<'_, GameStateStore>) -> Result<GameState, String> {
    state.get()
}

#[tauri::command]
pub fn update_game_state(
    app: tauri::AppHandle,
    state: tauri::State<'_, GameStateStore>,
    update: GameUpdate,
) -> Result<GameState, String> {
    let (snapshot, changed) = state.update(update)?;
    if changed {
        emit_progress(&app, &snapshot);
    }
    Ok(snapshot)
}
