//! One-shot speech through the Windows Runtime synthesizer.
//!
//! WebView2's `speechSynthesis` speaks a sentence twice on Windows as
//! soon as an utterance is given a voice. Rate, pitch, volume, and
//! cancelling an idle queue each add their own extra reading. The
//! clock builds the sentence in the page and hands it here, so a
//! single WinRT voice says it once.

use std::sync::mpsc::{self, Sender};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use tts::{Backends, Tts, Voice};

struct SpeechJob {
    text: String,
    voice_name: String,
    volume: f32,
}

fn sender() -> Option<&'static Sender<SpeechJob>> {
    static TX: OnceLock<Option<Sender<SpeechJob>>> = OnceLock::new();
    TX.get_or_init(|| {
        let (tx, rx) = mpsc::channel();
        match thread::Builder::new()
            .name("cyberclock-speech".into())
            .spawn(move || worker(rx))
        {
            Ok(_) => Some(tx),
            Err(err) => {
                log::warn!("speech thread did not start: {err}");
                None
            }
        }
    })
    .as_ref()
}

fn worker(rx: mpsc::Receiver<SpeechJob>) {
    let mut engine = match Tts::new(Backends::WinRt) {
        Ok(engine) => engine,
        Err(err) => {
            log::warn!("WinRT speech is unavailable: {err}");
            return;
        }
    };
    SPEECH_READY.store(true, std::sync::atomic::Ordering::Release);
    while let Ok(mut job) = rx.recv() {
        // Two windows can still deliver the same minute a few
        // milliseconds apart. Keep the latest and say it once.
        while let Ok(next) = rx.try_recv() {
            job = next;
        }
        if let Err(err) = say(&mut engine, &job) {
            log::warn!("speech failed: {err}");
        }
    }
}

fn say(engine: &mut Tts, job: &SpeechJob) -> Result<(), tts::Error> {
    let _ = engine.stop();
    if let Some(voice) = match_voice(engine, &job.voice_name) {
        if let Err(err) = engine.set_voice(&voice) {
            log::warn!("speech voice was not applied: {err}");
        }
    }
    engine.set_volume(job.volume.clamp(0.0, 1.0))?;
    engine.speak(&job.text, true)?;
    Ok(())
}

fn match_voice(engine: &Tts, wanted: &str) -> Option<Voice> {
    let wanted = wanted.trim();
    if wanted.is_empty() {
        return None;
    }
    let voices = engine.voices().ok()?;
    let wanted_l = wanted.to_lowercase();
    let head = wanted_l.split(" - ").next().unwrap_or(&wanted_l);
    voices.into_iter().find(|voice| {
        let name = voice.name().to_lowercase();
        name == wanted_l || name == head || wanted_l.starts_with(&name) || name.starts_with(head)
    })
}

/// Queue one sentence. Returns false when WinRT never came up, so the
/// page can fall back without selecting a WebView2 voice.
pub fn enqueue(text: String, voice_name: String, volume: f32) -> bool {
    let text = text.trim().to_string();
    if text.is_empty() {
        return false;
    }
    let Some(tx) = sender() else {
        return false;
    };
    if !engine_ready() {
        return false;
    }
    tx.send(SpeechJob {
        text,
        voice_name,
        volume,
    })
    .is_ok()
}

fn engine_ready() -> bool {
    // The first announcement waits for the synthesizer to construct.
    // Later calls find it already up.
    for _ in 0..40 {
        if speech_ready() {
            return true;
        }
        thread::sleep(Duration::from_millis(25));
    }
    speech_ready()
}

fn speech_ready() -> bool {
    // Probe by whether the worker has published a live engine. The
    // worker sets this after Tts::new succeeds.
    SPEECH_READY.load(std::sync::atomic::Ordering::Acquire)
}

static SPEECH_READY: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
