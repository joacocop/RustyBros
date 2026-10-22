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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rates_and_effect_allowlist() {
        assert!((frame_rate("30000/1001") - 29.97002997).abs() < 0.0001);
        assert_eq!(frame_rate("0/0"), 0.0);
        assert!(filter("movie=/private/file").is_err());
        for effect in [
            "grayscale",
            "sepia",
            "blur",
            "sharpen",
            "pixelate",
            "glitch",
        ] {
            assert!(filter(effect).is_ok());
        }
    }

    #[test]
    #[ignore = "Requiere los binarios FFmpeg/FFprobe de npm install"]
    fn real_effects_keep_trim_dimensions_and_audio() {
        let folder = std::env::temp_dir().join(format!("rustybros-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&folder).unwrap();
        let input = folder.join("source.mp4");
        run(
            "ffmpeg",
            &[
                "-v",
                "error",
                "-nostdin",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc2=size=320x180:rate=24",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:sample_rate=44100",
                "-t",
                "2",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                &input.to_string_lossy(),
            ]
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>(),
        )
        .unwrap();
        for effect in [
            "grayscale",
            "sepia",
            "blur",
            "sharpen",
            "pixelate",
            "glitch",
        ] {
            let output = folder.join(format!("{effect}.mp4"));
            transcode(
                &input.to_string_lossy(),
                &output,
                0.5,
                1.0,
                &[filter(effect).unwrap()],
            )
            .unwrap();
            let probe = run(
                "ffprobe",
                &[
                    "-v".into(),
                    "error".into(),
                    "-show_format".into(),
                    "-show_streams".into(),
                    "-of".into(),
                    "json".into(),
                    output.to_string_lossy().into(),
                ],
            )
            .unwrap();
            let data: Value = serde_json::from_slice(&probe.stdout).unwrap();
            assert!(
                (number(&data["format"]["duration"]).unwrap() - 1.0).abs() < 0.15,
                "{effect}"
            );
            let streams = data["streams"].as_array().unwrap();
            assert!(
                streams.iter().any(|s| s["codec_type"] == "audio"),
                "{effect}"
            );
            let video = streams.iter().find(|s| s["codec_type"] == "video").unwrap();
            assert_eq!(video["width"], 320, "{effect}");
            assert_eq!(video["height"], 180, "{effect}");
            // Decode the output as well, to detect corrupt but probeable files.
            run(
                "ffmpeg",
                &[
                    "-v".into(),
                    "error".into(),
                    "-i".into(),
                    output.to_string_lossy().into(),
                    "-f".into(),
                    "null".into(),
                    "-".into(),
                ],
            )
            .unwrap();
        }
        std::fs::remove_dir_all(folder).unwrap();
    }
}
