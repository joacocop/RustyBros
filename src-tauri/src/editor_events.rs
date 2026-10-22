use crate::game::{emit_progress, GameStateStore, RewardKind};
use serde::Serialize;
use tauri::{Emitter, Manager};

fn reward(app: &tauri::AppHandle, id: &str, kind: RewardKind) {
    if let Ok((state, true)) = app.state::<GameStateStore>().reward(id, kind) {
        emit_progress(app, &state);
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FilterApplied {
    id: String,
    duration: f64,
    effects_count: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoExported {
    id: String,
    duration: f64,
}

pub fn filter_applied(app: &tauri::AppHandle, duration: f64, effects_count: usize) {
    if effects_count == 0 {
        return;
    }
    let id = uuid::Uuid::new_v4().to_string();
    reward(app, &id, RewardKind::Effect);
    let _ = app.emit_to(
        "main",
        "filter-applied",
        FilterApplied {
            id,
            duration,
            effects_count,
        },
    );
}

pub fn video_exported(app: &tauri::AppHandle, id: &str, duration: f64) {
    reward(app, id, RewardKind::Export);
    let _ = app.emit_to(
        "main",
        "video-exported",
        VideoExported {
            id: id.to_owned(),
            duration,
        },
    );
}
