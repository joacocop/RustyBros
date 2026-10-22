#[path = "../src/game.rs"]
#[allow(dead_code)]
mod game;
use game::*;
use std::sync::Arc;

fn run() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn start(store: &GameStateStore, id: &str) {
    store
        .update(GameUpdate::StartRun { run_id: id.into() })
        .unwrap();
}
fn progress(coins: u32) -> GameProgress {
    GameProgress {
        gameplay_score: coins * 100,
        level: 1,
        lives: 3,
        collected_coins: coins,
        defeated: 0,
        time_left: 160.0,
        shield_seconds: 0.0,
        checkpoint: false,
        status: GameStatus::Running,
    }
}
fn update(
    id: &str,
    sequence: u64,
    acknowledged_reward_revision: u64,
    progress: GameProgress,
) -> GameUpdate {
    GameUpdate::Progress {
        run_id: id.into(),
        sequence,
        acknowledged_reward_revision,
        progress,
    }
}

#[test]
fn default_and_ipc_contract() {
    let store = GameStateStore::default();
    let state = store.get().unwrap();
    assert_eq!(
        (state.level, state.lives, state.score, state.time_left),
        (1, 3, 0, 180.0)
    );
    let id = run();
    let request: GameUpdate =
        serde_json::from_value(serde_json::json!({"action":"startRun", "runId":id})).unwrap();
    store.update(request).unwrap();
    let json = serde_json::to_value(store.get().unwrap()).unwrap();
    assert_eq!(json["runId"], id);
    assert_eq!(json["bonusScore"], 0);
    assert!(json.get("seen_runs").is_none());
    let request = serde_json::to_value(update(&id, 1, 0, progress(1))).unwrap();
    assert_eq!(request["acknowledgedRewardRevision"], 0);
    assert_eq!(request["progress"]["gameplayScore"], 100);
    store
        .update(serde_json::from_value(request).unwrap())
        .unwrap();
}

#[test]
fn achievements_and_totals_count_each_action_once() {
    let store = GameStateStore::default();
    let id = run();
    start(&store, &id);
    let mut p = progress(10);
    p.defeated = 1;
    p.gameplay_score += 200;
    p.checkpoint = true;
    store.update(update(&id, 2, 0, p.clone())).unwrap();
    store.update(update(&id, 1, 0, progress(1))).unwrap();
    store.update(update(&id, 2, 0, p.clone())).unwrap();
    p.status = GameStatus::Won;
    p.gameplay_score += 1000 + 160 * 5;
    store.update(update(&id, 3, 0, p.clone())).unwrap();
    store.update(update(&id, 4, 0, p)).unwrap();
    let state = store.get().unwrap();
    assert_eq!(state.achievements.len(), 6);
    assert_eq!(state.statistics.wins, 1);
    assert_eq!(state.statistics.collected_coins, 10);
    assert_eq!(state.statistics.defeated, 1);
    assert_eq!(state.statistics.best_score, 3000);
}

#[test]
fn restart_keeps_achievements_and_wallet_and_rejects_old_runs() {
    let store = GameStateStore::default();
    let first = run();
    start(&store, &first);
    store.reward(&run(), RewardKind::Export).unwrap();
    store.update(update(&first, 1, 1, progress(1))).unwrap();
    let second = run();
    start(&store, &second);
    start(&store, &second);
    let state = store.get().unwrap();
    assert_eq!(
        (state.score, state.coins, state.lives, state.collected_coins),
        (500, 5, 3, 0)
    );
    assert_eq!(state.achievements.len(), 1);
    assert_eq!(state.statistics.runs_started, 2);
    assert!(store.update(update(&first, 5, 1, progress(5))).is_err());
    assert!(store
        .update(GameUpdate::StartRun { run_id: first })
        .is_err());
    assert_eq!(store.get().unwrap().statistics.collected_coins, 1);
}

#[test]
fn concurrent_editor_reward_is_not_overwritten_by_an_older_game_snapshot() {
    let store = GameStateStore::default();
    let id = run();
    start(&store, &id);
    let effect = run();
    store.reward(&effect, RewardKind::Effect).unwrap();
    store.reward(&run(), RewardKind::Export).unwrap();
    assert!(!store.reward(&effect, RewardKind::Effect).unwrap().1);
    store.update(update(&id, 1, 0, progress(1))).unwrap();
    let state = store.get().unwrap();
    assert_eq!(
        (
            state.score,
            state.coins,
            state.bonus_score,
            state.bonus_coins
        ),
        (700, 7, 600, 6)
    );
    assert_eq!(state.shield_seconds, 15.0);
    store.update(update(&id, 2, 2, progress(1))).unwrap();
    assert_eq!(store.get().unwrap().shield_seconds, 0.0);
}

#[test]
fn mutex_preserves_concurrent_rewards_and_progress() {
    let store = Arc::new(GameStateStore::default());
    let id = run();
    start(&store, &id);
    let threads: Vec<_> = (0..8)
        .map(|n| {
            let store = store.clone();
            let id = id.clone();
            std::thread::spawn(move || {
                for i in 0..25 {
                    store
                        .reward(&format!("{n}-{i}"), RewardKind::Effect)
                        .unwrap();
                    store
                        .update(update(&id, n * 25 + i + 1, 0, progress(1)))
                        .unwrap();
                }
            })
        })
        .collect();
    for thread in threads {
        thread.join().unwrap();
    }
    let state = store.get().unwrap();
    assert_eq!(state.score, 20100);
    assert_eq!(state.coins, 201);
    assert_eq!(state.rewards.len(), 200);
    assert_eq!(state.statistics.collected_coins, 1);
}

#[test]
fn invalid_progress_does_not_mutate_the_store() {
    let store = GameStateStore::default();
    let id = run();
    start(&store, &id);
    for p in [
        GameProgress {
            lives: 4,
            ..progress(0)
        },
        GameProgress {
            time_left: f64::NAN,
            ..progress(0)
        },
        GameProgress {
            shield_seconds: -1.0,
            ..progress(0)
        },
        progress(25),
        GameProgress {
            gameplay_score: 9999,
            ..progress(0)
        },
        GameProgress {
            status: GameStatus::Lost,
            ..progress(0)
        },
    ] {
        assert!(store.update(update(&id, 1, 0, p)).is_err());
    }
    assert!(store.update(update(&id, 1, 5, progress(0))).is_err());
    assert_eq!(store.get().unwrap().revision, 1);
}
