use crate::processing::{filter, frame_rate, number, run, transcode};
use serde::Serialize;
use serde_json::Value;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::Manager;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    path: String,
    name: String,
    pub(crate) duration: f64,
    width: u64,
    height: u64,
    fps: f64,
    codec: String,
    audio_codec: Option<String>,
    size: u64,
    preview_path: String,
}

#[derive(Default)]
pub struct MediaStore(Mutex<HashMap<String, VideoMetadata>>);

impl MediaStore {
    pub(crate) fn video(&self, path: &str) -> Result<VideoMetadata, String> {
        self.0
            .lock()
            .map_err(|_| "No se pudo acceder a la biblioteca.")?
            .get(path)
            .cloned()
            .ok_or_else(|| "Primero importá el archivo.".into())
    }
    pub(crate) fn paths(&self) -> Result<Vec<String>, String> {
        Ok(self
            .0
            .lock()
            .map_err(|_| "No se pudo acceder a la biblioteca.")?
            .keys()
            .cloned()
            .collect())
    }
}

#[derive(Serialize)]
pub struct ProcessedPreview {
    path: String,
    start: f64,
    end: f64,
}

fn preview_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("previews")
        .join(format!("{}.mp4", uuid::Uuid::new_v4())))
}

#[tauri::command]
pub async fn import_video(
    app: tauri::AppHandle,
    state: tauri::State<'_, MediaStore>,
    path: String,
) -> Result<VideoMetadata, String> {
    let handle = app.clone();
    let metadata =
        tauri::async_runtime::spawn_blocking(move || -> Result<VideoMetadata, String> {
            let canonical = std::fs::canonicalize(&path)
                .map_err(|e| format!("No se pudo abrir el archivo: {e}"))?;
            let extension = canonical
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if !["mp4", "mov", "avi", "mkv"].contains(&extension.as_str()) {
                return Err("Elegí un archivo MP4, MOV, AVI o MKV.".into());
            }
            let path = canonical.to_string_lossy().to_string();
            let output = run(
                "ffprobe",
                &[
                    "-v".into(),
                    "error".into(),
                    "-show_format".into(),
                    "-show_streams".into(),
                    "-of".into(),
                    "json".into(),
                    path.clone(),
                ],
            )?;
            let data: Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
            let streams = data["streams"]
                .as_array()
                .ok_or("El archivo no contiene pistas.")?;
            let video = streams
                .iter()
                .find(|s| s["codec_type"] == "video" && s["disposition"]["attached_pic"] != 1)
                .ok_or("No se encontró una pista de video.")?;
            let duration = number(&data["format"]["duration"])
                .or_else(|| number(&video["duration"]))
                .ok_or("No se pudo determinar la duración.")?;
            if !duration.is_finite() || duration <= 0.0 {
                return Err("El video no tiene una duración válida.".into());
            }
            let width = video["width"]
                .as_u64()
                .filter(|n| *n > 0)
                .ok_or("Ancho de video inválido.")?;
            let height = video["height"]
                .as_u64()
                .filter(|n| *n > 0)
                .ok_or("Alto de video inválido.")?;
            let codec = video["codec_name"]
                .as_str()
                .unwrap_or("desconocido")
                .to_owned();
            let audio_codec = streams
                .iter()
                .find(|s| s["codec_type"] == "audio")
                .and_then(|s| s["codec_name"].as_str())
                .map(str::to_owned);
            let compatible = extension == "mp4"
                && codec == "h264"
                && video["pix_fmt"] == "yuv420p"
                && audio_codec
                    .as_deref()
                    .is_none_or(|c| c == "aac" || c == "mp3");
            let preview = if compatible {
                canonical.clone()
            } else {
                let preview = preview_path(&handle)?;
                transcode(&path, &preview, 0.0, duration, &[])?;
                preview
            };
            handle
                .asset_protocol_scope()
                .allow_file(&preview)
                .map_err(|e| e.to_string())?;
            Ok(VideoMetadata {
                name: canonical
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into(),
                size: canonical.metadata().map_err(|e| e.to_string())?.len(),
                fps: frame_rate(video["avg_frame_rate"].as_str().unwrap_or("0/1")),
                width,
                height,
                duration,
                codec,
                audio_codec,
                path,
                preview_path: preview.to_string_lossy().into(),
            })
        })
        .await
        .map_err(|e| e.to_string())??;
    state
        .0
        .lock()
        .map_err(|_| "No se pudo acceder a la biblioteca.")?
        .insert(metadata.path.clone(), metadata.clone());
    Ok(metadata)
}

#[tauri::command]
pub async fn apply_effects(
    app: tauri::AppHandle,
    state: tauri::State<'_, MediaStore>,
    path: String,
    start: f64,
    end: f64,
    effects: Vec<String>,
) -> Result<ProcessedPreview, String> {
    let metadata = state
        .0
        .lock()
        .map_err(|_| "No se pudo acceder a la biblioteca.")?
        .get(&path)
        .cloned()
        .ok_or("Primero importá el archivo.")?;
    if !start.is_finite()
        || !end.is_finite()
        || start < 0.0
        || end <= start
        || end > metadata.duration + 0.001
    {
        return Err("El rango de recorte no es válido.".into());
    }
    if effects.len() > 6 {
        return Err("Se permiten hasta seis efectos.".into());
    }
    let filters = effects
        .iter()
        .map(|e| filter(e))
        .collect::<Result<Vec<_>, _>>()?;
    tauri::async_runtime::spawn_blocking(move || {
        let output = preview_path(&app)?;
        transcode(&path, &output, start, end - start, &filters)?;
        app.asset_protocol_scope()
            .allow_file(&output)
            .map_err(|e| e.to_string())?;
        crate::editor_events::filter_applied(&app, end - start, effects.len());
        Ok(ProcessedPreview {
            path: output.to_string_lossy().into(),
            start,
            end,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
