// src/pages/VoiceScan.jsx  – Real WebRTC recording + FastAPI analysis
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Mic, MicOff, Globe, RefreshCw, Brain, AlertTriangle,
    CheckCircle, Info, Volume2, ChevronRight, Wifi, Activity, ShieldCheck,
    Server, AlertCircle, Loader, Users, Utensils
} from 'lucide-react';
import { LANGUAGES, AI_TIPS } from '../data/mockData';
import { api, checkBackendHealth } from '../api/client';

// ── Waveform visualizer ────────────────────────────────────────────────────────
function WaveBars({ bars }) {
    return (
        <div className="waveform-container" style={{ height: 70, gap: 2 }}>
            {Array.from({ length: 24 }).map((_, i) => {
                const amp = bars[i] ?? 0.1;
                return (
                    <div
                        key={i}
                        style={{
                            width: 3,
                            borderRadius: 3,
                            background: 'linear-gradient(to top,var(--brand-1),var(--brand-2))',
                            height: `${Math.max(6, amp * 65)}px`,
                            transition: 'height 0.08s ease',
                            opacity: 0.7 + amp * 0.3,
                        }}
                    />
                );
            })}
        </div>
    );
}

// ── Semicircle risk gauge ──────────────────────────────────────────────────────
function RiskArc({ score }) {
    const s = isNaN(score) ? 0 : score;
    const r = 80, cx = 110, cy = 100;
    const rad = ((s / 100) * 180 - 180) * (Math.PI / 180);
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    const color = s < 30 ? '#10b981' : s < 50 ? '#fbbf24' : s < 80 ? '#f97316' : '#ef4444';
    return (
        <svg width="220" height="115" viewBox="0 0 220 115">
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${(s / 100) * Math.PI * r} ${Math.PI * r}`}
                style={{ transition: 'all 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 10px ${color})` }} />
            <circle cx={x} cy={y} r="7" fill={color}
                style={{ transition: 'all 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color})` }} />
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="36" fontWeight="900" fill={color} fontFamily="Outfit,sans-serif">{s}</text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="12" fill="var(--text-muted)" fontFamily="Inter,sans-serif">/ 100 Risk Score</text>
        </svg>
    );
}

// ── Backend status pill ────────────────────────────────────────────────────────
function BackendStatus({ status }) {
    const cfg = {
        checking: { color: 'var(--accent-amber)', label: 'Checking backend…', icon: <Loader size={12} className="spin" /> },
        online: { color: 'var(--accent-green)', label: 'Backend Online ✓', icon: <Server size={12} /> },
        offline: { color: 'var(--accent-red)', label: 'Backend Offline — start it!', icon: <AlertCircle size={12} /> },
        no_model: { color: 'var(--accent-amber)', label: 'Backend running — model not ready', icon: <AlertTriangle size={12} /> },
    };
    const c = cfg[status] || cfg.checking;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px',
            borderRadius: 20, background: 'rgba(255,255,255,0.06)', fontSize: 12,
            border: `1px solid ${c.color}33`, color: c.color, fontWeight: 600,
        }}>
            {c.icon} {c.label}
        </span>
    );
}

// ── Supported MIME types, in order of preference ──────────────────────────────
const SUPPORTED_MIME = [
    'audio/mp4',              // iOS Safari
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
];

function getSupportedMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const m of SUPPORTED_MIME) {
        if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
}

// ─────────────────────────────────────────────────────────────────────────────
export default function VoiceScan({ onNavigate, patients = [], activePatientId, setActivePatientId, setVocalResult, motorResult }) {
    const [stage, setStage] = useState('idle');  // idle|recording|analyzing|result|error
    const [lang, setLang] = useState(LANGUAGES[0]);
    const [elapsed, setElapsed] = useState(0);
    const [bars, setBars] = useState(new Array(24).fill(0.08));
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [analysisSteps, setAnalysisSteps] = useState([]);
    const [backendStatus, setBackendStatus] = useState('checking'); // checking|online|offline|no_model
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const transcriptRef = useRef(null);

    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const timerRef = useRef(null);
    const analyserRef = useRef(null);
    const animFrameRef = useRef(null);
    const streamRef = useRef(null);
    const stepsTimers = useRef([]);
    const recognitionRef = useRef(null);

    // Auto-scroll transcription
    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [transcript, interimTranscript]);

    const selectedPatient = (patients && patients.length > 0)
        ? (patients.find(p => p.id === activePatientId) || patients[0])
        : null;

    const STEPS = [
        'Converting audio to 22 kHz mono WAV…',
        'Praat: Extracting fundamental frequency (F0)…',
        'Praat: Computing MDVP Jitter & Shimmer…',
        'Praat: Measuring Harmonics-to-Noise Ratio…',
        'librosa: Extracting 13 MFCCs…',
        'XGBoost: Running Parkinson\'s classifier…',
        'Generating clinical recommendations…',
    ];

    // ── Check backend health on mount and every 15s ────────────────────────────
    const pingBackend = useCallback(async () => {
        setBackendStatus('checking');
        const h = await checkBackendHealth();
        if (!h.online) {
            setBackendStatus('offline');
        } else if (!h.modelReady) {
            setBackendStatus('no_model');
        } else {
            setBackendStatus('online');
        }
    }, []);

    useEffect(() => {
        const initPing = async () => {
            await pingBackend();
        };
        initPing();
        const interval = setInterval(pingBackend, 15000);
        return () => clearInterval(interval);
    }, [pingBackend]);

    // ── Live waveform via Web Audio API ───────────────────────────────────────
    const startVisualizer = useCallback((stream) => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            analyser.getByteFrequencyData(data);
            const barVals = Array.from({ length: 24 }, (_, i) => {
                const idx = Math.floor(i * data.length / 24);
                return data[idx] / 255;
            });
            setBars(barVals);
            animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
    }, []);

    const stopVisualizer = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setBars(new Array(24).fill(0.08));
    };

    // ── Clear analysis step timers ─────────────────────────────────────────────
    const clearStepTimers = () => {
        stepsTimers.current.forEach(t => clearTimeout(t));
        stepsTimers.current = [];
    };

    // ── Start recording ────────────────────────────────────────────────────────
    const startRecording = async () => {
        setError('');

        if (!selectedPatient) {
            setError('Please select or create a patient first.');
            return;
        }

        if (backendStatus === 'offline') {
            setError('Backend is offline. Please start it by running start_backend.bat, then wait a few seconds and try again.');
            return;
        }

        if (backendStatus === 'no_model') {
            setError('ML model is not ready. The backend needs to train the model first. Run start_backend.bat and wait for it to finish training.');
            return;
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                }
            });
            streamRef.current = stream;
        } catch (e) {
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setError('Microphone access denied. Allow microphone access in your browser settings and try again.');
            } else if (e.name === 'NotFoundError') {
                setError('No microphone found. Please connect a microphone and try again.');
            } else {
                setError(`Microphone error: ${e.message}`);
            }
            return;
        }

        const mimeType = getSupportedMime();
        const opts = mimeType ? { mimeType } : {};

        let mr;
        try {
            mr = new MediaRecorder(stream, opts);
        } catch {
            mr = new MediaRecorder(stream);
        }
        mediaRecorder.current = mr;
        audioChunks.current = [];

        mr.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunks.current.push(e.data);
        };

        mr.onstop = () => {
            // Build the blob from collected chunks
            const finalMime = mr.mimeType || mimeType || 'audio/webm';
            const blob = new Blob(audioChunks.current, { type: finalMime });
            console.log(`[VoiceScan] Recording stopped. Chunks: ${audioChunks.current.length}, Total: ${(blob.size / 1024).toFixed(1)} KB, MIME: ${finalMime}`);
            if (blob.size < 5000) {
                setError('Recording too short. Please sustain an "aaaah" sound for at least 5-10 seconds for a valid clinical scan.');
                setStage('error');
                return;
            }
            runAnalysis(blob);
        };

        mr.onerror = (e) => {
            console.error('[VoiceScan] MediaRecorder error:', e);
            setError(`Recording error: ${e.error?.message || 'Unknown recording error'}`);
            setStage('error');
        };

        mr.start(250);  // collect chunks every 250ms for reliable data
        setStage('recording');
        setElapsed(0);
        setTranscript('');
        startVisualizer(stream);

        // ── Start Speech Recognition ──────────────────────────────────────────
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            
            // Map simple codes to full locales for browser recognition
            const localeMap = {
                'en': 'en-US',
                'hi': 'hi-IN',
                'kn': 'kn-IN',
                'te': 'te-IN',
                'ta': 'ta-IN',
                'es': 'es-ES'
            };
            recognition.lang = localeMap[lang.code] || 'en-US';

            recognition.onstart = () => console.log('[Speech] Recognition started');
            recognition.onresult = (event) => {
                let currentFinal = '';
                let currentInterim = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcriptPiece = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        currentFinal += transcriptPiece + ' ';
                    } else {
                        currentInterim += transcriptPiece;
                    }
                }
                
                console.log(`[Speech] Final: "${currentFinal}" | Interim: "${currentInterim}"`);
                if (currentFinal) {
                    setTranscript(prev => prev + currentFinal);
                }
                setInterimTranscript(currentInterim);
            };

            recognition.onerror = (event) => {
                console.error('[Speech] Error:', event.error);
                if (event.error === 'not-allowed') {
                    setError('Speech recognition permission denied.');
                }
            };

            recognition.onend = () => console.log('[Speech] Recognition ended');
            
            try {
                recognition.start();
                recognitionRef.current = recognition;
            } catch (e) {
                console.error('[Speech] Start error:', e);
            }
        } else {
            console.warn('[Speech] Web Speech API not supported in this browser.');
        }

        timerRef.current = setInterval(() => {
            setElapsed(e => {
                if (e >= 30) {
                    stopRecording();
                    return 30;
                }
                return e + 1;
            });
        }, 1000);
    };

    const stopRecording = () => {
        clearInterval(timerRef.current);
        stopVisualizer();
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop();  // This triggers mr.onstop → runAnalysis
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setStage('analyzing');
    };

    // ── Send to backend for real analysis ──────────────────────────────────────
    const runAnalysis = async (audioBlob) => {
        if (!selectedPatient) {
            setError("No patient selected. Please register/select a patient in the Patients tab first.");
            setStage('error');
            return;
        }

        setAnalysisSteps([]);
        clearStepTimers();

        // Animate step-by-step UI feedback while waiting for API
        STEPS.forEach((_, i) => {
            const t = setTimeout(() => setAnalysisSteps(prev => [...prev, i]), i * 900);
            stepsTimers.current.push(t);
        });

        try {
            console.log('[VoiceScan] Sending audio to backend for analysis...');
            const data = await api.analyzeVoice(selectedPatient.id, audioBlob, lang.code);
            console.log('[VoiceScan] Analysis result received:', data);
            clearStepTimers();
            setAnalysisSteps(STEPS.map((_, i) => i));  // Mark all steps done
            setTimeout(() => {
                setResult(data);
                setVocalResult(data); // Save to global state
                setStage('result');

            }, 400);
        } catch (e) {
            clearStepTimers();
            console.error('[VoiceScan] Analysis error:', e);
            setError(`Analysis failed: ${e.message}`);
            setStage('error');
        }
    };

    const reset = () => {
        clearInterval(timerRef.current);
        clearStepTimers();
        stopVisualizer();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop();
        }
        setStage('idle');
        setResult(null);
        setError('');
        setElapsed(0);
        setTranscript('');
        setInterimTranscript('');
        setAnalysisSteps([]);
    };

    useEffect(() => () => {
        clearInterval(timerRef.current);
        clearStepTimers();
        stopVisualizer();
    }, []);

    const rc = result?.prediction?.risk_label;
    const riskColor = rc === 'Low' ? 'green' : rc === 'Medium' ? 'amber' : 'red';
    const tips = AI_TIPS[lang.code] || AI_TIPS['en'];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Voice Scan</h1>
                    <p className="page-subtitle">Real MDVP biomarker extraction · XGBoost Parkinson's classifier · UCI dataset</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <BackendStatus status={backendStatus} />
                    <span className="badge badge-purple"><Globe size={11} /> AI4Bharat</span>
                    <span className="badge badge-cyan">Praat + XGBoost</span>
                </div>
            </div>

            <div className="page-body">
                {(!patients || patients.length === 0) && (
                    <div className="fade-in" style={{ textAlign: 'center', marginTop: 80, padding: 40, background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <AlertCircle size={40} color="var(--accent-purple)" />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, marginBottom: 12 }}>No Patients Registered</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 30, maxWidth: 400, margin: '0 auto 30px' }}>
                            A patient profile is required to store and analyze vocal biomarkers. Please register a patient first.
                        </p>
                        <button className="btn btn-primary btn-xl" onClick={() => onNavigate('patients')}>
                            Go to Patient Registry
                        </button>
                    </div>
                )}

                {patients && patients.length > 0 && <>

                    {/* Backend offline warning */}
                    {backendStatus === 'offline' && (
                        <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                            <AlertCircle size={18} style={{ flexShrink: 0 }} />
                            <div>
                                <strong>Backend is not running!</strong> Voice analysis requires the Python backend.
                                <br />
                                <span style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
                                    Double-click <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>start_backend.bat</code> in your project folder, wait for it to say "Uvicorn running", then refresh.
                                </span>
                                <button
                                    className="btn btn-ghost"
                                    style={{ marginTop: 10, fontSize: 12, padding: '4px 12px' }}
                                    onClick={pingBackend}
                                >
                                    <RefreshCw size={12} /> Retry Connection
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Model not ready warning */}
                    {backendStatus === 'no_model' && (
                        <div className="alert" style={{ marginBottom: 20, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
                            <AlertTriangle size={18} style={{ flexShrink: 0, color: 'var(--accent-amber)' }} />
                            <div style={{ color: 'var(--accent-amber)' }}>
                                <strong>ML model is training…</strong> The XGBoost model is being trained on the UCI Parkinson's dataset.
                                <br />
                                <span style={{ fontSize: 13 }}>This only happens once and takes ~30 seconds. Leave start_backend.bat open and wait.</span>
                                <button
                                    className="btn btn-ghost"
                                    style={{ marginTop: 10, fontSize: 12, padding: '4px 12px', display: 'block' }}
                                    onClick={pingBackend}
                                >
                                    <RefreshCw size={12} /> Check Again
                                </button>
                            </div>
                        </div>
                    )}

                    {/* iPhone connection notice */}
                    <div className="alert alert-info" style={{ marginBottom: 20 }}>
                        <Wifi size={16} style={{ flexShrink: 0 }} />
                        <div>
                            <strong>Using iPhone?</strong> Make sure your phone and computer are on the same Wi-Fi.
                            Access <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                                https://[your-computer-IP]:5174
                            </code> in Safari. iPhone needs a different API URL — see .env file.
                        </div>
                    </div>

                    {/* Patient selector */}
                    <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)', flexShrink: 0 }}>Patient:</div>
                        {patients.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--accent-amber)' }}>
                                ⚠️ No patients yet. Go to <strong>Patients</strong> tab and register a patient first.
                            </div>
                        ) : (
                            <select
                                className="input"
                                style={{ maxWidth: 260 }}
                                value={selectedPatient?.id || ''}
                                onChange={e => setActivePatientId(Number(e.target.value))}
                            >
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} · Age {p.age}</option>
                                ))}
                            </select>
                        )}
                        {selectedPatient && (
                            <span className="badge badge-cyan">{selectedPatient.name}</span>
                        )}
                    </div>

                    {/* ── IDLE / ERROR stage ─────────────────────────────────────────────── */}
                    {(stage === 'idle' || stage === 'error') && <div className="fade-in">
                        <div className="grid-2" style={{ marginBottom: 20 }}>
                            {/* Language selector */}
                            <div className="card">
                                <div className="section-title"><Globe size={16} color="var(--accent-purple)" /> Language</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {LANGUAGES.map(l => (
                                        <button key={l.code} className={`lang-card${lang.code === l.code ? ' selected' : ''}`}
                                            style={{ padding: '10px 14px' }} onClick={() => setLang(l)}>
                                            <span className="lang-flag">{l.flag}</span>
                                            <div><div className="lang-name" style={{ fontSize: 13 }}>{l.name}</div><div className="lang-native">{l.native}</div></div>
                                            {lang.code === l.code && <CheckCircle size={14} color="var(--accent-cyan)" style={{ marginLeft: 'auto' }} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reading prompt + tips */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div className="card card-gradient-purple">
                                    <div className="section-title"><Volume2 size={16} color="var(--accent-purple)" /> Reading Prompt</div>
                                    <p style={{
                                        fontSize: 14, lineHeight: 1.7, fontStyle: 'italic',
                                        background: 'rgba(255,255,255,0.04)', padding: '12px 16px',
                                        borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)'
                                    }}>
                                        &ldquo;{lang.prompt}&rdquo;
                                    </p>
                                </div>
                                <div className="card card-gradient-cyan" style={{ border: '2px solid var(--accent-cyan)' }}>
                                    <div className="section-title"><ShieldCheck size={16} color="var(--accent-cyan)" /> Hybrid Clinical Protocol</div>
                                    <div style={{ marginBottom: 14 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 4 }}>🔬 WHY THE "AAAAAH"?</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            Sustaining a steady tone for just <strong>10 seconds</strong> allows the AI to measure your vocal tremors without word interference.
                                            After that, feel free to read the prompt naturally!
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(34,211,238,0.06)', padding: 12, borderRadius: 10, fontSize: 12, color: 'var(--accent-cyan)', marginBottom: 10, border: '1px solid var(--accent-cyan)44' }}>
                                        ✅ Speak naturally after the initial burst. The AI now uses <strong>Segmented Phonation</strong> to filter out speaking pauses.
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {tips.map((t, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                                                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{i + 1}.</span> {t}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="alert alert-danger">
                                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                                    <div>
                                        <strong>Error:</strong> {error}
                                    </div>
                                </div>
                            )}

                            {!selectedPatient && backendStatus === 'online' && (
                                <div className="alert alert-amber" style={{ marginBottom: 15, background: 'rgba(251,191,36,0.1)' }}>
                                    <Users size={16} />
                                    <div>
                                        <strong>No Patient Selected:</strong> Go to the <strong>Patients</strong> tab, register a patient, then come back here.
                                        <button className="btn btn-ghost" onClick={() => onNavigate('patients')} style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                                            → Go Register Patient
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-xl"
                                id="btn-start-scan"
                                disabled={!selectedPatient || backendStatus !== 'online'}
                                onClick={startRecording}
                                style={{ position: 'relative' }}
                            >
                                {backendStatus === 'checking' ? (
                                    <><Loader size={20} className="spin" /> Connecting to backend…</>
                                ) : backendStatus === 'offline' ? (
                                    <><AlertCircle size={20} /> Backend Offline — Cannot Scan</>
                                ) : !selectedPatient ? (
                                    <><Users size={22} /> Register Patient to Start</>
                                ) : (
                                    <><Mic size={22} /> Start 30-Second Scan</>
                                )}
                            </button>
                            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                                Audio is analyzed on your local server and stored securely. Never sent to third parties.
                            </p>
                        </div>
                    </div>
                    }

                    {/* ── RECORDING stage ─────────────────────────────────────────────────── */}
                    {stage === 'recording' && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, paddingTop: 20 }}>
                            <div style={{ textAlign: 'center' }}>
                                <span className="badge badge-red" style={{ fontSize: 13, padding: '6px 18px' }}>● REC LIVE</span>
                                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>{lang.flag} Recording in {lang.name}</div>
                            </div>

                            <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div className="pulse-ring" style={{ width: 120, height: 120, top: 10, left: 10 }} />
                                <div className="pulse-ring" style={{ width: 120, height: 120, top: 10, left: 10, animationDelay: '0.6s' }} />
                                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(239,68,68,0.5)', zIndex: 1 }}>
                                    <Mic size={36} color="white" />
                                </div>
                            </div>

                            {/* Real waveform from Web Audio API */}
                            <WaveBars bars={bars} />

                            {/* Real-time Transcription Box */}
                            <div 
                                ref={transcriptRef}
                                style={{
                                width: '100%',
                                maxWidth: 520,
                                minHeight: 80,
                                maxHeight: 120,
                                overflowY: 'auto',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 12,
                                padding: '12px 16px',
                                fontSize: 14,
                                lineHeight: 1.6,
                                color: 'var(--text-secondary)',
                                textAlign: 'left',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                            }}>
                                {!(window.SpeechRecognition || window.webkitSpeechRecognition) ? (
                                    <div style={{ color: 'var(--accent-amber)', fontSize: 12 }}>
                                        ⚠️ Live transcription is only supported in Chrome, Edge, and Safari. 
                                        Please switch browsers for the full demo.
                                    </div>
                                ) : transcript || interimTranscript ? (
                                    <>
                                        <span>{transcript}</span>
                                        <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{interimTranscript}</span>
                                    </>
                                ) : 'Start speaking to see real-time transcription…'}
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 900, lineHeight: 1 }}>
                                    {String(elapsed).padStart(2, '0')}<span style={{ fontSize: 24, color: 'var(--text-muted)' }}> / 30s</span>
                                </div>
                                <div style={{ marginTop: 12 }}>
                                    <div className="progress-bar-wrap" style={{ width: 280, margin: '0 auto' }}>
                                        <div className="progress-bar-fill" style={{ width: `${(elapsed / 30) * 100}%`, background: 'linear-gradient(90deg,var(--brand-1),#ef4444)' }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                                    {elapsed < 3 ? 'Keep speaking…' : elapsed < 10 ? 'Good! Continue reading…' : '🎤 Great! You can stop now or let it finish.'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    className="btn btn-danger"
                                    id="btn-stop-analyze"
                                    onClick={stopRecording}
                                    disabled={elapsed < 2}
                                >
                                    <MicOff size={16} /> Stop & Analyze
                                </button>
                                <button className="btn btn-ghost" onClick={reset}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* ── ANALYZING stage ─────────────────────────────────────────────────── */}
                    {stage === 'analyzing' && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 30 }}>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow-purple)' }}>
                                <Brain size={36} color="white" className="spin" />
                            </div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>
                                Analyzing with Praat + XGBoost…
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                This may take 10–40 seconds. Processing audio on your local server.
                            </div>
                            <div style={{ width: '100%', maxWidth: 520 }}>
                                {STEPS.map((step, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)'
                                    }}>
                                        <div style={{
                                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0, transition: 'all 0.4s ease',
                                            background: i < analysisSteps.length ? 'var(--accent-green)' : i === analysisSteps.length ? 'var(--brand-1)' : 'rgba(255,255,255,0.06)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {i < analysisSteps.length
                                                ? <CheckCircle size={13} color="white" />
                                                : i === analysisSteps.length
                                                    ? <div className="spin" style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                                                    : null}
                                        </div>
                                        <span style={{ fontSize: 13, color: i <= analysisSteps.length ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── RESULT stage ────────────────────────────────────────────────────── */}
                    {stage === 'result' && result && (
                        <div className="fade-in">
                            {/* Risk card */}
                            <div className={`risk-result-card risk-${riskColor}`} style={{ marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                    <div className="badge badge-purple" style={{ fontSize: 10 }}>VQI: {Math.round(result.prediction?.confidence || 0)}% Integrity</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <span className={`badge badge-${riskColor}`} style={{ fontSize: 13 }}>
                                        {rc === 'Low' ? '✅' : rc === 'Medium' ? '⚠️' : '🚨'} {rc} Risk
                                    </span>
                                    <span className="badge badge-purple">{result.prediction?.model_version}</span>
                                    <span className="badge badge-cyan">Confidence: {result.prediction?.confidence}%</span>
                                </div>
                                <RiskArc score={Math.round(result.prediction?.risk_score || 0)} />
                                <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520, margin: '12px auto 0', lineHeight: 1.6 }}>
                                    {result.prediction?.interpretation}
                                </p>

                            </div>

                            {/* Core Decision Drivers (Feature Importance) */}
                            <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--brand-1)' }}>
                                <div className="section-title">
                                    <Activity size={16} color="var(--brand-1)" /> AI Decision Drivers
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', fontWeight: 400 }}>Based on XGBoost Weightings</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                                    {[
                                        { label: 'PPE (Pitch Period Entropy)', weight: 16.1, color: 'var(--accent-cyan)', info: 'Measures vocal control randomness.' },
                                        { label: 'MDVP:APQ (Shimmer APQ11)', weight: 13.0, color: 'var(--accent-purple)', info: 'Detects micro-fluctuations in amplitude.' },
                                        { label: 'MDVP:Fo (Avg Pitch)', weight: 10.0, color: 'var(--accent-amber)', info: 'Fundamental frequency deviations.' },
                                    ].map((f, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                <span style={{ fontWeight: 600 }}>{f.label}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>{f.weight}% Influence</span>
                                            </div>
                                            <div className="progress-bar-wrap" style={{ height: 6, background: 'rgba(255,255,255,0.05)' }}>
                                                <div className="progress-bar-fill" style={{
                                                    width: `${(f.weight / 16.1) * 100}%`,
                                                    background: f.color,
                                                    boxShadow: `0 0 10px ${f.color}44`
                                                }} />
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{f.info}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Precision Insights */}
                            {result.clinical?.precision_insights?.length > 0 && (
                                <div className="card card-gradient-cyan" style={{ marginBottom: 20, border: '1px solid var(--accent-cyan)33' }}>
                                    <div className="section-title"><Brain size={16} color="var(--accent-cyan)" /> Precision AI Insights</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {result.clinical.precision_insights.map((insight, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)', marginTop: 6, flexShrink: 0 }} />
                                                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                    {insight}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Abnormal flags */}
                            {result.abnormal_flags?.length > 0 && (
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div className="section-title"><AlertTriangle size={16} color="var(--accent-amber)" /> Abnormal Biomarker Flags</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {result.abnormal_flags.map((f, i) => (
                                            <div key={i} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                                                borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.biomarker}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Normal: {f.normal_range}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 800, color: f.severity === 'High' ? 'var(--accent-red)' : 'var(--accent-amber)', fontFamily: 'var(--font-display)', fontSize: 18 }}>
                                                        {f.value} {f.unit}
                                                    </div>
                                                    <span className={`badge badge-${f.severity === 'High' ? 'red' : 'amber'}`}>{f.severity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Key biomarkers grid */}
                            <div className="grid-2" style={{ marginBottom: 20 }}>
                                {[
                                    { label: 'F0 (Avg Pitch)', value: `${Number(result.biomarkers?.fo_mean || 0).toFixed(1)} Hz`, normal: '85–255 Hz', color: '#c084fc' },
                                    { label: 'PPE (Pitch Entropy)', value: `${Number(result.biomarkers?.ppe || 0).toFixed(3)}`, normal: '< 0.20', color: '#22d3ee' },
                                    { label: 'Jitter (Local)', value: `${(Number(result.biomarkers?.jitter_local || 0) * 100).toFixed(3)}%`, normal: '< 1.04%', color: '#fbbf24' },
                                    { label: 'Shimmer (APQ11)', value: `${(Number(result.biomarkers?.shimmer_apq11 || 0) * 100).toFixed(3)}%`, normal: '< 3.12%', color: '#f472b6' },
                                    { label: 'HNR (Clarity)', value: `${Number(result.biomarkers?.hnr || 0).toFixed(2)} dB`, normal: '> 20 dB', color: '#34d399' },
                                    { label: 'PD Probability', value: `${(Number(result.prediction?.parkinson_prob || 0) * 100).toFixed(1)}%`, normal: '< 35%', color: rc === 'High' ? '#f87171' : '#34d399' },
                                ].map((b, i) => (
                                    <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                        <div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{b.label}</div>
                                            <div style={{ fontSize: 24, fontWeight: 900, color: b.color, fontFamily: 'var(--font-display)', marginBottom: 2 }}>{b.value}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Normal: {b.normal}</div>
                                        </div>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${b.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Activity size={18} color={b.color} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Clinical stage */}
                            <div className="card card-gradient-purple" style={{ marginBottom: 20 }}>
                                <div className="section-title"><Brain size={16} color="var(--accent-purple)" /> Clinical Stage Assessment</div>
                                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                    <div style={{ fontSize: 48, filter: 'drop-shadow(0 0 10px var(--accent-purple))' }}>🏥</div>
                                    <div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#e879f9', marginBottom: 4 }}>
                                            {result.clinical?.clinical_stage}
                                        </div>
                                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            {result.clinical?.stage_description}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Immediate steps */}
                            {result.clinical?.immediate_steps?.length > 0 && (
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div className="section-title"><ChevronRight size={16} color="var(--accent-red)" /> Immediate Actions</div>
                                    <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {result.clinical.immediate_steps.map((s, i) => (
                                            <li key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{s}</li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Diagnostic tests */}
                            {result.clinical?.diagnostic_tests?.length > 0 && (
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div className="section-title"><Info size={16} color="var(--accent-cyan)" /> Recommended Diagnostic Tests</div>
                                    <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {result.clinical.diagnostic_tests.map((t, i) => (
                                            <li key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{t}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Speech therapy */}
                            {result.clinical?.speech_therapy?.length > 0 && (
                                <div className="card" style={{ marginBottom: 20 }}>
                                    <div className="section-title"><Volume2 size={16} color="var(--accent-green)" /> Speech Therapy Protocol (LSVT LOUD)</div>
                                    <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {result.clinical.speech_therapy.map((t, i) => (
                                            <li key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{t}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* References */}
                            {result.clinical?.references?.length > 0 && (
                                <div className="card" style={{ marginBottom: 24 }}>
                                    <div className="section-title" style={{ fontSize: 13 }}>📚 Clinical References</div>
                                    <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {result.clinical.references.map((r, i) => (
                                            <li key={i} style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Nutritional Advice */}
                            <div className="card card-gradient-green" style={{ marginBottom: 20, border: '1px solid var(--accent-green)33' }}>
                                <div className="section-title"><Utensils size={16} color="var(--accent-green)" /> AI Nutritional Support</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    {rc === 'High' ?
                                        "A high-antioxidant, anti-inflammatory diet is critical. Focus on Omega-3 fatty acids from fish and flax seeds to support neurological repair." :
                                        rc === 'Medium' ?
                                            "Subtle changes detected. We recommend increasing your intake of berries and leafy greens to boost neuro-protection." :
                                            "Maintaining a Mediterranean-style diet is recommended to preserve your currently stable biomarkers."
                                    }
                                    <br /><br />
                                    <strong>Recommended Recipe:</strong> {
                                        rc === 'High' ? "Baked Salmon with Lemon & Dill" :
                                            rc === 'Medium' ? "Berry & Flax Seed Smoothie" :
                                                "Walnut & Spinach Salad"
                                    }
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button className="btn btn-secondary" onClick={reset}><RefreshCw size={16} /> New Scan</button>
                                {rc !== 'Low' && (
                                    <>
                                        <button className="btn btn-purple" onClick={() => onNavigate('motor')}>
                                            <Activity size={16} /> Perform Motor Test
                                        </button>
                                        <button className="btn btn-primary" onClick={() => onNavigate('appointment')}>
                                            <ChevronRight size={16} /> Book Consultation
                                        </button>
                                    </>
                                )}
                                <button className="btn btn-xl btn-green" style={{ width: '100%', marginTop: 12, border: '2px solid white' }} onClick={() => onNavigate('recipes')}>
                                    <Utensils size={20} /> VIEW 50+ BRAIN-HEALTHY RECIPES
                                </button>
                            </div>
                        </div>
                    )}
                </>
                }
            </div>
        </div>
    );
}
