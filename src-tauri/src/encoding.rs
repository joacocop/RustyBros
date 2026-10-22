use crate::processing::{binary, filter};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    io::{BufRead, BufReader},
    path::Path,
    process::{Command, Stdio},
};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Mp4,
    Webm,
    Gif,
}

impl OutputFormat {
    pub fn extension(self) -> &'static str {
        match self {
            Self::Mp4 => "mp4",
            Self::Webm => "webm",
            Self::Gif => "gif",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    Low,
    Medium,
    High,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub enum Resolution {
    #[serde(rename = "original")]
    Original,
    #[serde(rename = "480p")]
    P480,
    #[serde(rename = "720p")]
    P720,
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "2160p")]
    P2160,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ExportSettings {
    pub format: OutputFormat,
    pub quality: Quality,
    pub resolution: Resolution,
    pub fps: u32,
}

pub fn export_args(
    input: &str,
    output: &Path,
    start: f64,
    duration: f64,
    effects: &[String],
    settings: &ExportSettings,
) -> Result<Vec<String>, String> {
    if !start.is_finite() || start < 0.0 || !duration.is_finite() || duration <= 0.0 {
        return Err("El rango de exportación no es válido.".into());
    }
    if ![12, 15, 24, 25, 30, 50, 60].contains(&settings.fps) {
        return Err("FPS no permitidos.".into());
    }
    if effects.len() > 6 {
        return Err("Se permiten hasta seis efectos.".into());
    }
    let mut filters = effects
        .iter()
        .map(|effect| filter(effect).map(str::to_string))
        .collect::<Result<Vec<_>, _>>()?;
    filters.push(format!("fps={}", settings.fps));
    filters.push(match settings.resolution {
        Resolution::Original => "scale=ceil(iw/2)*2:ceil(ih/2)*2".to_owned(),
        Resolution::P480 => "scale=-2:480:flags=lanczos".to_owned(),
        Resolution::P720 => "scale=-2:720:flags=lanczos".to_owned(),
        Resolution::P1080 => "scale=-2:1080:flags=lanczos".to_owned(),
        Resolution::P2160 => "scale=-2:2160:flags=lanczos".to_owned(),
    });
    // Limit the input as well as the output: palette generation must see only the selected clip.
    let mut args: Vec<String> = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-progress",
        "pipe:1",
        "-stats_period",
        "0.2",
        "-nostats",
        "-ss",
        &start.to_string(),
        "-t",
        &duration.to_string(),
        "-i",
        input,
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    if settings.format == OutputFormat::Gif {
        let colors = match settings.quality {
            Quality::Low => 64,
            Quality::Medium => 128,
            Quality::High => 256,
        };
        let graph = format!("[0:v:0]{},split[a][b];[a]palettegen=max_colors={colors}:reserve_transparent=0[p];[b][p]paletteuse=dither=sierra2_4a[v]", filters.join(","));
        args.extend([
            "-filter_complex_threads".into(),
            "1".into(),
            "-filter_complex".into(),
            graph,
            "-map".into(),
            "[v]".into(),
            "-an".into(),
            "-loop".into(),
            "0".into(),
        ]);
    } else {
        args.extend([
            "-map".into(),
            "0:v:0".into(),
            "-map".into(),
            "0:a:0?".into(),
            "-vf".into(),
            filters.join(","),
            "-threads".into(),
            "2".into(),
        ]);
        let codec: Vec<&str> = match settings.format {
            OutputFormat::Mp4 => vec![
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                match settings.quality {
                    Quality::High => "18",
                    Quality::Medium => "23",
                    Quality::Low => "28",
                },
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
            ],
            _ => vec![
                "-c:v",
                "libvpx-vp9",
                "-b:v",
                "0",
                "-crf",
                match settings.quality {
                    Quality::High => "24",
                    Quality::Medium => "32",
                    Quality::Low => "40",
                },
                "-cpu-used",
                "4",
                "-row-mt",
                "1",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "libopus",
                "-b:a",
                "128k",
            ],
        };
        args.extend(codec.iter().map(|s| s.to_string()));
    }
    args.extend([
        "-t".into(),
        duration.to_string(),
        output.to_string_lossy().to_string(),
    ]);
    Ok(args)
}

pub fn progress_seconds(line: &str) -> Option<f64> {
    let value = line
        .strip_prefix("out_time_us=")?
        .trim()
        .parse::<f64>()
        .ok()?
        / 1_000_000.0;
    value.is_finite().then_some(value.max(0.0))
}

pub fn encode(args: &[String], mut on_progress: impl FnMut(f64)) -> Result<(), String> {
    let mut command = Command::new(binary("ffmpeg"));
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .spawn()
        .map_err(|e| format!("No se pudo ejecutar FFmpeg: {e}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or("FFmpeg no abrió su canal de progreso.")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("FFmpeg no abrió su canal de diagnóstico.")?;
    // Drain stderr concurrently so a full error pipe can never stall the encoder.
    let diagnostic = std::thread::spawn(move || {
        let mut tail = VecDeque::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if tail.len() == 8 {
                tail.pop_front();
            }
            tail.push_back(line);
        }
        tail.into_iter().collect::<Vec<_>>().join("\n")
    });
    let mut read_error = None;
    for line in BufReader::new(stdout).lines() {
        match line {
            Ok(line) => {
                if let Some(seconds) = progress_seconds(&line) {
                    on_progress(seconds);
                }
            }
            Err(error) => {
                read_error = Some(error.to_string());
                let _ = child.kill();
                break;
            }
        }
    }
    let status = child.wait().map_err(|e| e.to_string());
    let detail = diagnostic
        .join()
        .unwrap_or_else(|_| "No se pudo leer el diagnóstico.".into());
    if let Some(error) = read_error {
        return Err(format!("Se interrumpió el canal de progreso: {error}"));
    }
    if !status?.success() {
        return Err(format!("FFmpeg no pudo exportar el video: {detail}"));
    }
    Ok(())
}
