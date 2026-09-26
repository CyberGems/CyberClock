/**
 * CyberClock - Voice Time Announcer (Talking Clock)
 * Uses native Web Speech API (speechSynthesis) to speak the time offline.
 * Supports natural and cyber/tactical styles in English and Spanish,
 * gender selection (male/female/system), pre-chimes, and volume control.
 */
(function () {
    'use strict';

    let voices = [];
    let voicesLoaded = false;
    const voicesListeners = [];

    function notifyVoicesReady() {
        voicesListeners.forEach(fn => {
            try { fn(voices); } catch (_) {}
        });
    }

    function loadVoices() {
        if (!('speechSynthesis' in window)) return;
        try {
            voices = window.speechSynthesis.getVoices() || [];
            if (voices.length > 0) {
                voicesLoaded = true;
                notifyVoicesReady();
            }
        } catch (_) {}
    }

    if ('speechSynthesis' in window) {
        loadVoices();
        try {
            window.speechSynthesis.onvoiceschanged = () => {
                loadVoices();
            };
        } catch (_) {}
    }

    function getBestVoice(lang, genderPreference, specificName) {
        if (!voices || voices.length === 0) loadVoices();
        if (voices.length === 0) return null;

        if (specificName && specificName !== 'auto') {
            const found = voices.find(v => v.name === specificName);
            if (found) return found;
        }

        const isEs = (lang || '').toLowerCase().startsWith('es');
        const langPrefix = isEs ? 'es' : 'en';

        const langVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
        const pool = langVoices.length > 0 ? langVoices : voices;

        if (genderPreference === 'female') {
            const femalePatterns = [/female/i, /helena/i, /laura/i, /sabina/i, /zira/i, /jenny/i, /samantha/i, /victoria/i, /monica/i, /paulina/i];
            const f = pool.find(v => femalePatterns.some(p => p.test(v.name)));
            if (f) return f;
        } else if (genderPreference === 'male') {
            const malePatterns = [/male/i, /raul/i, /david/i, /mark/i, /george/i, /guy/i, /jorge/i, /pablo/i];
            const m = pool.find(v => malePatterns.some(p => p.test(v.name)));
            if (m) return m;
        }

        return pool[0] || null;
    }

    function formatAnnouncementText(hour, minute, lang, style) {
        const isEs = (lang || 'auto') === 'es' || (lang === 'auto' && navigator.language.startsWith('es'));
        const h24 = hour;
        const m = minute;

        if (isEs) {
            if (style === 'cyber') {
                const hStr = String(h24).padStart(2, '0');
                const mStr = String(m).padStart(2, '0');
                return `CyberClock. Hora actual: ${hStr} ${mStr} horas.`;
            }
            if (style === 'concise') {
                const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                return m === 0 ? `${h12} en punto.` : `${h12} ${m}.`;
            }

            // Natural Spanish
            let h12 = h24 % 12;
            if (h12 === 0) h12 = 12;

            const part = h24 < 12 ? 'de la mañana' : (h24 < 19 ? 'de la tarde' : 'de la noche');
            const prefix = h12 === 1 ? 'Es la una' : `Son las ${h12}`;

            let mText = '';
            if (m === 0) mText = 'en punto';
            else if (m === 15) mText = 'y cuarto';
            else if (m === 30) mText = 'y media';
            else if (m === 45) mText = 'y cuarenta y cinco';
            else mText = `y ${m}`;

            return `${prefix} ${mText} ${part}.`;
        } else {
            if (style === 'cyber') {
                const hStr = String(h24).padStart(2, '0');
                const mStr = String(m).padStart(2, '0');
                return `CyberClock. Current time: ${hStr} ${mStr} hours.`;
            }
            if (style === 'concise') {
                const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                const mStr = m === 0 ? "o'clock" : (m < 10 ? `oh ${m}` : String(m));
                return `${h12} ${mStr}.`;
            }

            // Natural English
            let h12 = h24 % 12;
            if (h12 === 0) h12 = 12;
            const ampm = h24 < 12 ? 'AM' : 'PM';

            let mText = '';
            if (m === 0) mText = "o'clock";
            else if (m < 10) mText = `oh ${m}`;
            else mText = String(m);

            return `It is ${h12} ${mText} ${ampm}.`;
        }
    }

    function announce(cfg, hour, minute) {
        if (!('speechSynthesis' in window)) return;
        const va = (cfg && cfg.voiceAnnouncer) || {};
        if (cfg && cfg.audioMuted) return;

        const now = new Date();
        const h = Number.isInteger(hour) ? hour : now.getHours();
        const m = Number.isInteger(minute) ? minute : now.getMinutes();

        const lang = (cfg && cfg.language) || 'auto';
        const text = formatAnnouncementText(h, m, lang, va.style || 'natural');
        const voice = getBestVoice(lang, va.voiceGender || 'auto', va.voiceName);

        const doSpeak = () => {
            try {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(text);
                if (voice) utter.voice = voice;
                utter.volume = Math.max(0, Math.min(1, va.volume ?? 0.85));
                utter.rate = 0.95;
                window.speechSynthesis.speak(utter);
            } catch (_) {}
        };

        if (va.chimeBefore !== false && window.audioEngine) {
            try {
                window.audioEngine.chime('chime-crystal', (va.volume ?? 0.85) * 0.7);
            } catch (_) {}
            setTimeout(doSpeak, 450);
        } else {
            doSpeak();
        }
    }

    window.VoiceAnnouncer = {
        announce,
        getVoices: () => {
            if (!voices || voices.length === 0) loadVoices();
            return voices;
        },
        reloadVoices: () => {
            loadVoices();
            notifyVoicesReady();
            return voices;
        },
        onVoicesReady: (cb) => {
            if (typeof cb !== 'function') return;
            voicesListeners.push(cb);
            if (voicesLoaded && voices.length > 0) {
                try { cb(voices); } catch (_) {}
            }
        },
        getBestVoice,
        formatAnnouncementText
    };
})();
