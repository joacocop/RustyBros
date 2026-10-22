use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    process::{Command, Output},
};

pub(crate) fn binary(name: &str) -> PathBuf {
    if let Some(path) = std::env::var_os(format!("RUSTYBROS_{}", name.to_uppercase())) {
        return path.into();
    }
    // npm supplies local development binaries; production packaging is RB13.
    if cfg!(debug_assertions) {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        let relative = match (name, std::env::consts::OS) {
            ("ffmpeg", "windows") => "node_modules/ffmpeg-static/ffmpeg.exe".to_owned(),
            ("ffmpeg", _) => "node_modules/ffmpeg-static/ffmpeg".to_owned(),
            ("ffprobe", "windows") => {
                "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe".to_owned()
            }
            ("ffprobe", "macos") => "node_modules/ffprobe-static/bin/darwin/x64/ffprobe".to_owned(),
            _ => "node_modules/ffprobe-static/bin/linux/x64/ffprobe".to_owned(),
        };
        let local = root.join(relative);
        if local.is_file() {
            return local;
        }
    }
    PathBuf::from(name)
}

pub(crate) fn run(name: &str, args: &[String]) -> Result<Output, String> {
    let mut command = Command::new(binary(name));
    command.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let output = command.output().map_err(|e| {
        format!(
            "No se pudo ejecutar {name}. Instalá las dependencias o configurá RUSTYBROS_{}. {e}",
            name.to_uppercase()
        )
    })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let last_lines = stderr
            .lines()
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        return Err(format!("{name} no pudo procesar el archivo: {last_lines}"));
    }
    Ok(output)
}

pub(crate) fn number(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
}

pub(crate) fn frame_rate(value: &str) -> f64 {
    let mut parts = value.split('/');
    let numerator = parts
        .next()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    let denominator = parts
        .next()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(1.0);
    if denominator > 0.0 {
        numerator / denominator
    } else {
        0.0
    }
}

pub(crate) fn transcode(
    input: &str,
    output: &Path,
    start: f64,
    duration: f64,
    filters: &[&str],
) -> Result<(), String> {
    // Even dimensions and H.264/AAC make previews playable in the native WebView.
    let mut chain = filters.to_vec();
    chain.push("scale=ceil(iw/2)*2:ceil(ih/2)*2");
    let args: Vec<String> = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-ss",
        &start.to_string(),
        "-i",
        input,
        "-t",
        &duration.to_string(),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        &chain.join(","),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        &output.to_string_lossy(),
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    if let Err(error) = run("ffmpeg", &args) {
        let _ = std::fs::remove_file(output);
        return Err(error);
    }
    Ok(())
}

pub(crate) fn filter(effect: &str) -> Result<&'static str, String> {
    match effect {
        "grayscale" => Ok("hue=s=0"),
        "sepia" => Ok("colorchannelmixer=.393:.769:.189:.349:.686:.168:.272:.534:.131"),
        "blur" => Ok("gblur=sigma=3"),
        "sharpen" => Ok("unsharp=5:5:1.2:5:5:0"),
        "pixelate" => Ok("pixelize=w=16:h=16"),
        "glitch" => Ok("rgbashift=rh=8:bh=-8:rv=2:bv=-2,noise=alls=12:allf=t"),
        _ => Err(format!("Efecto no permitido: {effect}")),
    }
}
