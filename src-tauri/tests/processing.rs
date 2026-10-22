#[path = "../src/processing.rs"]
mod processing;
use processing::*;
use serde_json::Value;

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
