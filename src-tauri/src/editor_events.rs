use serde::Serialize;
use tauri::Emitter;

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
    let _ = app.emit_to(
        "main",
        "filter-applied",
        FilterApplied {
            id: uuid::Uuid::new_v4().to_string(),
            duration,
            effects_count,
        },
    );
}

pub fn video_exported(app: &tauri::AppHandle, id: &str, duration: f64) {
    let _ = app.emit_to(
        "main",
        "video-exported",
        VideoExported {
            id: id.to_owned(),
            duration,
        },
    );
}
