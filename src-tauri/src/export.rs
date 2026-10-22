use crate::{
    encoding::{encode, export_args, ExportSettings},
    video::MediaStore,
};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::Emitter;

#[derive(Default)]
pub struct ExportState(pub Arc<AtomicBool>);
struct ExportGuard(Arc<AtomicBool>);
impl Drop for ExportGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    job_id: String,
    path: String,
    output: String,
    start: f64,
    end: f64,
    effects: Vec<String>,
    settings: ExportSettings,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportProgress {
    job_id: String,
    percent: f64,
    encoded_seconds: f64,
    status: &'static str,
}

fn destination(path: &str, extension: &str, imported: &[String]) -> Result<PathBuf, String> {
    let requested = Path::new(path);
    if requested
        .extension()
        .and_then(|s| s.to_str())
        .map(str::to_lowercase)
        .as_deref()
        != Some(extension)
    {
        return Err(format!(
            "El archivo de salida debe terminar en .{extension}."
        ));
    }
    let parent = requested
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or("Elegí una carpeta de destino válida.")?;
    let parent = parent
        .canonicalize()
        .map_err(|e| format!("No se pudo abrir la carpeta de destino: {e}"))?;
    if !parent.is_dir() {
        return Err("El destino no es una carpeta.".into());
    }
    let normalized = if requested.exists() {
        requested.canonicalize().map_err(|e| e.to_string())?
    } else {
        parent.join(requested.file_name().ok_or("Nombre de archivo inválido.")?)
    };
    if imported.iter().any(|p| Path::new(p) == normalized) {
        return Err("Elegí otro nombre: no se puede reemplazar un video importado.".into());
    }
    if normalized.is_dir() {
        return Err("El destino es una carpeta, no un archivo.".into());
    }
    Ok(normalized)
}

#[tauri::command]
pub async fn export_video(
    app: tauri::AppHandle,
    media: tauri::State<'_, MediaStore>,
    active: tauri::State<'_, ExportState>,
    request: ExportRequest,
) -> Result<String, String> {
    let metadata = media.video(&request.path)?;
    if !request.start.is_finite()
        || !request.end.is_finite()
        || request.start < 0.0
        || request.end <= request.start
        || request.end > metadata.duration + 0.001
    {
        return Err("El rango de exportación no es válido.".into());
    }
    if uuid::Uuid::parse_str(&request.job_id).is_err() {
        return Err("Identificador de exportación inválido.".into());
    }
    let output = destination(
        &request.output,
        request.settings.format.extension(),
        &media.paths()?,
    )?;
    let temporary = output.parent().unwrap().join(format!(
        ".rustybros-{}.{}",
        uuid::Uuid::new_v4(),
        request.settings.format.extension()
    ));
    let duration = request.end - request.start;
    let args = export_args(
        &request.path,
        &temporary,
        request.start,
        duration,
        &request.effects,
        &request.settings,
    )?;
    if active
        .0
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Ya hay una exportación en curso.".into());
    }
    let guard = ExportGuard(active.0.clone());
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let emit = |percent, encoded_seconds, status| {
            let _ = app.emit_to(
                "main",
                "export-progress",
                ExportProgress {
                    job_id: request.job_id.clone(),
                    percent,
                    encoded_seconds,
                    status,
                },
            );
        };
        emit(0.0, 0.0, "processing");
        let mut maximum: f64 = 0.0;
        let mut encoded: f64 = 0.0;
        let result = encode(&args, |seconds| {
            maximum = maximum.max((seconds / duration * 100.0).clamp(0.0, 99.5));
            encoded = encoded.max(seconds.min(duration));
            emit(maximum, encoded, "processing");
        })
        .and_then(|_| {
            std::fs::rename(&temporary, &output).map_err(|e| {
                format!("El video se procesó, pero no se pudo guardar en el destino: {e}")
            })
        });
        if let Err(error) = result {
            let _ = std::fs::remove_file(&temporary);
            emit(maximum, encoded, "failed");
            return Err(error);
        }
        emit(100.0, duration, "completed");
        crate::editor_events::video_exported(&app, &request.job_id, duration);
        Ok(output.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}
