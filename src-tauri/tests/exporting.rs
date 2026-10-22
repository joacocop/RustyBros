#[path = "../src/encoding.rs"]
mod encoding;
#[path = "../src/processing.rs"]
#[allow(dead_code)]
mod processing;

use encoding::*;
use processing::{number, run};

#[test]
fn rejects_invalid_settings_and_progress_noise() {
    let mut settings = ExportSettings {
        format: OutputFormat::Mp4,
        quality: Quality::Medium,
        resolution: Resolution::Original,
        fps: 120,
    };
    assert!(export_args("a", std::path::Path::new("b.mp4"), 0.0, 1.0, &[], &settings).is_err());
    settings.fps = 30;
    assert!(export_args(
        "a",
        std::path::Path::new("b.mp4"),
        f64::NAN,
        1.0,
        &[],
        &settings
    )
    .is_err());
    assert!(export_args(
        "a",
        std::path::Path::new("b.mp4"),
        0.0,
        1.0,
        &["movie=secret".into()],
        &settings
    )
    .is_err());
    assert_eq!(progress_seconds("out_time_us=1500000"), Some(1.5));
    assert_eq!(progress_seconds("out_time_us=-2500"), Some(0.0));
    assert_eq!(progress_seconds("out_time_us=NaN"), None);
    assert_eq!(progress_seconds("progress=end"), None);
}

#[test]
#[ignore = "Requiere FFmpeg y FFprobe locales"]
fn exports_all_formats_with_trim_fps_resolution_audio_and_live_progress() {
    let folder =
        std::env::temp_dir().join(format!("rustybros-export-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&folder).unwrap();
    let input = folder.join("entrada con espacios.mp4");
    run(
        "ffmpeg",
        &[
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=24",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440",
            "-t",
            "3",
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
    for format in [OutputFormat::Mp4, OutputFormat::Webm, OutputFormat::Gif] {
        let output = folder.join(format!("salida.{}", format.extension()));
        let settings = ExportSettings {
            format,
            quality: Quality::Low,
            resolution: Resolution::P480,
            fps: 15,
        };
        let args = export_args(
            &input.to_string_lossy(),
            &output,
            0.5,
            1.0,
            &["sepia".into()],
            &settings,
        )
        .unwrap();
        let mut progress = Vec::new();
        encode(&args, |seconds| progress.push(seconds)).unwrap();
        assert!(
            !progress.is_empty(),
            "{format:?} debe informar progreso real"
        );
        assert!(progress.iter().any(|p| *p > 0.0));
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
        let data: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
        let duration = if format == OutputFormat::Gif {
            // The bundled FFprobe 4 does not expose GIF container duration.
            let frames = run(
                "ffprobe",
                &[
                    "-v".into(),
                    "error".into(),
                    "-show_frames".into(),
                    "-show_entries".into(),
                    "frame=pkt_duration_time".into(),
                    "-of".into(),
                    "json".into(),
                    output.to_string_lossy().into(),
                ],
            )
            .unwrap();
            let frames: serde_json::Value = serde_json::from_slice(&frames.stdout).unwrap();
            frames["frames"]
                .as_array()
                .unwrap()
                .iter()
                .filter_map(|frame| number(&frame["pkt_duration_time"]))
                .sum::<f64>()
        } else {
            number(&data["format"]["duration"]).unwrap()
        };
        assert!((duration - 1.0).abs() < 0.2, "{format:?}: {duration}");
        let streams = data["streams"].as_array().unwrap();
        let video = streams.iter().find(|s| s["codec_type"] == "video").unwrap();
        assert_eq!(video["height"], 480);
        let codec = match format {
            OutputFormat::Mp4 => "h264",
            OutputFormat::Webm => "vp9",
            OutputFormat::Gif => "gif",
        };
        assert_eq!(video["codec_name"], codec);
        assert_eq!(
            streams.iter().any(|s| s["codec_type"] == "audio"),
            format != OutputFormat::Gif
        );
        let actual_fps = processing::frame_rate(video["avg_frame_rate"].as_str().unwrap_or("0"));
        assert!((actual_fps - 15.0).abs() < 1.0, "{format:?}: {actual_fps}");
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
