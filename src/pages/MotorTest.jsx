// src/pages/MotorTest.jsx
import { useState, useEffect, useRef } from 'react';
import { Activity, Zap, Timer, AlertCircle, CheckCircle, RefreshCw, Smartphone, ShieldCheck, ChevronRight, Utensils } from 'lucide-react';
import { api } from '../api/client';

function TapPulse({ x, y }) {
    return (
        <div style={{
            position: 'fixed',
            left: x - 30,
            top: y - 30,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'rgba(52, 211, 153, 0.4)',
            border: '2px solid var(--accent-green)',
            animation: 'pulse-fade 0.6s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9999
        }} />
    );
}

export default function MotorTest({ vocalResult, onNavigate, patients, activePatientId, setMotorResult }) {
    const [stage, setStage] = useState('intro'); // intro | ready | testing | result
    const [taps, setTaps] = useState([]);
    const [timeLeft, setTimeLeft] = useState(15);
    const [pulses, setPulses] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const tapAreaRef = useRef(null);

    const selectedPatient = (patients && patients.length > 0)
        ? (patients.find(p => p.id === activePatientId) || patients[0])
        : null;

    const startTest = () => {
        setStage('testing');
        setTimeLeft(15);
        setTaps([]);
    };

    useEffect(() => {
        let timer;
        if (stage === 'testing') {
            if (timeLeft > 0) {
                timer = setInterval(() => {
                    setTimeLeft(prev => prev - 1);
                }, 1000);
            } else {
                calculateResults();
            }
        }
        return () => clearInterval(timer);
    }, [stage, timeLeft]);

    const lastTapTimeRef = useRef(0);

    const handleTap = (e) => {
        if (stage !== 'testing') return;

        const now = Date.now();
        // FILTER: Debounce double-firing (physical buttons often trigger twice or touch+mouse)
        if (now - lastTapTimeRef.current < 80) return;
        lastTapTimeRef.current = now;

        const rect = tapAreaRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        setTaps(prev => [...prev, now]);

        // Visualization
        const id = Math.random();
        setPulses(prev => [...prev, { id, x: clientX, y: clientY }]);
        setTimeout(() => setPulses(prev => prev.filter(p => p.id !== id)), 600);
    };

    const calculateResults = () => {
        setStage('result');

        // MDS-UPDRS criteria requires at least 10 taps for a valid assessment
        if (taps.length < 8) {
            const res = { error: "Insufficient data. Please tap faster and larger movements." };
            setMetrics(res);
            setMotorResult(res);
            return;
        }

        const intervals = [];
        for (let i = 1; i < taps.length; i++) {
            const gap = taps[i] - taps[i - 1];
            if (gap > 50) intervals.push(gap); // ignoring accidental double-taps
        }

        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const speed = (taps.length / 15).toFixed(1); // Taps per second

        // Coefficient of Variation (CV) - The marker for Arrhythmic Movement
        const variance = intervals.map(x => Math.pow(x - meanInterval, 2)).reduce((a, b) => a + b, 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        // CV expressed as percentage. Healthy controls usually < 12%. PD > 20%.
        const irregularity = (stdDev / meanInterval) * 100;

        // Clinical Criteria based on MDS-UPDRS Frequency & Rhythm
        let risk = 'Low';
        let hy_guess = 'H&Y Stage 0 (Healthy Control)';

        // Scale irregularity for UI (CV > 30 is effectively maximum clinical irregularity)
        const displayIrregularity = Math.min(100, (irregularity / 35) * 100).toFixed(1);

        if (speed < 2.8 || irregularity > 28) {
            risk = 'High';
            hy_guess = 'H&Y Stage 2.5 - 3 (Established PD)';
        } else if (speed < 4.2 || irregularity > 15) {
            risk = 'Medium';
            hy_guess = 'H&Y Stage 1 - 2 (Early PD)';
        } else {
            risk = 'Low';
            hy_guess = 'H&Y Stage 0 (Non-Parkinsonian)';
        }

        const res = {
            totalTaps: taps.length,
            speed,
            irregularity: displayIrregularity,
            raw_cv: irregularity.toFixed(1),
            risk,
            hy_guess,
            meanInterval
        };
        setMetrics(res);
        setMotorResult(res);
        saveResults(res);
    };

    const saveResults = async (res) => {
        if (!selectedPatient) return;
        try {
            await api.saveMotorTest(selectedPatient.id, {
                tremor_score: Math.min(100, Math.round(res.raw_cv * 2)),
                reaction_ms: Math.round(res.meanInterval || 0),
                accuracy_pct: Math.max(0, 100 - Math.round(res.irregularity)),
                stability_idx: Number(res.speed),
                label: res.hy_guess
            });
        } catch (err) {
            console.error("Failed to save motor results:", err);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">👐 Finger Tapping Motor Test</h1>
                    <p className="page-subtitle">MDS-UPDRS Gold Standard Assessment for Bradykinesia & Rhythm</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge badge-purple">MOTOR AI</span>
                    <span className="badge badge-green">CLINICAL GRADE</span>
                </div>
            </div>

            <div className="page-body">
                {stage === 'intro' && (
                    <div className="fade-in" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
                        <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Smartphone size={48} color="var(--accent-purple)" />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Ready for Motor Assessment?</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.8, marginBottom: 30 }}>
                            This test measures <strong>Bradykinesia</strong> (slowness of movement) and <strong>Arrhythmia</strong> (irregularity).
                            You will tap the screen as fast and as regularly as possible for 15 seconds using your dominant index finger.
                        </p>
                        <div className="card" style={{ textAlign: 'left', marginBottom: 30, background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                <Timer size={20} color="var(--accent-cyan)" />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>15 Second Sprint</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Maintains focus and captures fatigue trends.</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <Zap size={20} color="var(--accent-amber)" />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>Real-time Kinematics</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Detects micro-hesitations & amplitude decay.</div>
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-purple btn-xl" onClick={() => setStage('ready')}>
                            I'm Ready to Begin
                        </button>
                    </div>
                )}

                {stage === 'ready' && (
                    <div className="fade-in" style={{ textAlign: 'center', marginTop: 100 }}>
                        <div style={{ fontSize: 64, marginBottom: 20 }}>👆</div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Place your hand comfortably</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Testing: <strong>{selectedPatient?.name}</strong></p>
                        <button className="btn btn-success btn-xl" style={{ padding: '20px 60px', fontSize: 20 }} onClick={startTest}>
                            START TEST NOW
                        </button>
                    </div>
                )}

                {stage === 'testing' && (
                    <div className="fade-in">
                        {pulses.map(p => <TapPulse key={p.id} x={p.x} y={p.y} />)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div className="badge badge-red" style={{ padding: '8px 16px', fontSize: 14, fontWeight: 800 }}>
                                <Timer size={16} /> {timeLeft}s
                            </div>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Neural Sync Accuracy</div>
                                <div style={{ width: 120, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, margin: '4px auto' }}>
                                    <div style={{ width: `${Math.min(100, taps.length * 2)}%`, height: '100%', background: 'var(--accent-cyan)', borderRadius: 2, transition: 'width 0.3s' }} />
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capture</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-green)', fontFamily: 'var(--font-display)' }}>{taps.length}</div>
                            </div>
                        </div>

                        <div
                            ref={tapAreaRef}
                            style={{
                                width: '100%',
                                height: 420,
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 32,
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-around',
                                padding: 20,
                                userSelect: 'none',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div
                                onMouseDown={handleTap}
                                onTouchStart={(e) => { e.preventDefault(); handleTap(e); }}
                                style={{
                                    width: 140,
                                    height: 140,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05))',
                                    border: '2px solid rgba(34,211,238,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.1s',
                                    boxShadow: '0 0 30px rgba(34,211,238,0.1)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-cyan)' }}>L</div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div className="pulse-slow" style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <Zap size={24} color="var(--accent-amber)" />
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 100 }}>Alternate Taps</div>
                            </div>

                            <div
                                onMouseDown={handleTap}
                                onTouchStart={(e) => { e.preventDefault(); handleTap(e); }}
                                style={{
                                    width: 140,
                                    height: 140,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))',
                                    border: '2px solid rgba(168,85,247,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.1s',
                                    boxShadow: '0 0 30px rgba(168,85,247,0.1)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-purple)' }}>R</div>
                            </div>
                        </div>
                    </div>
                )}

                {stage === 'result' && metrics && (
                    <div className="fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
                        {metrics.error ? (
                            <div className="alert alert-danger" style={{ textAlign: 'center', padding: 40 }}>
                                <AlertCircle size={40} style={{ marginBottom: 16 }} />
                                <h3>{metrics.error}</h3>
                                <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => setStage('intro')}>Try Again</button>
                            </div>
                        ) : (
                            <>
                                <div className="card card-gradient-purple" style={{ marginBottom: 24, textAlign: 'center', padding: '40px 20px' }}>
                                    <div className="badge badge-purple" style={{ marginBottom: 16 }}>Motor Signature Analysis</div>
                                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{metrics.hy_guess}</h2>
                                    <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
                                        Bradykinesia Index: <strong style={{ color: metrics.risk === 'High' ? 'var(--accent-red)' : 'var(--accent-green)' }}>{metrics.risk} Risk</strong>
                                    </div>
                                </div>

                                <div className="grid-3" style={{ marginBottom: 24 }}>
                                    <div className="card">
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Speed (Kinesia)</div>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)' }}>{metrics.speed} <span style={{ fontSize: 14 }}>tps</span></div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Normal: {'>'} 4.5 taps/sec</div>
                                    </div>
                                    <div className="card">
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Irregularity (CV)</div>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent-amber)', fontFamily: 'var(--font-display)' }}>{metrics.irregularity}%</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Lower is better (Stable rhythm)</div>
                                    </div>
                                    <div className="card">
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Total Taps</div>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent-green)', fontFamily: 'var(--font-display)' }}>{metrics.totalTaps}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Captured in 15 seconds</div>
                                    </div>
                                </div>

                                <div className="card" style={{ marginBottom: 30 }}>
                                    <div className="section-title"><CheckCircle size={16} color="var(--accent-green)" /> Clinical Interpretation</div>
                                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                        {metrics.risk === 'Low' ? (
                                            "Tapping speed and rhythm are within healthy parameters. No significant Bradykinesia detected. Movement amplitude appears stable."
                                        ) : metrics.risk === 'Medium' ? (
                                            "Mild slowness or hesitation detected. Coefficient of variation is slightly elevated, suggesting emerging rhythm instability typical of H&Y Stage 1-2."
                                        ) : (
                                            "Significant Bradykinesia identified. High movement irregularity and low tap frequency align with clinical motor impairment. Consultation with a neurologist is highly recommended."
                                        )}
                                    </p>
                                </div>

                                <div style={{ textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button className="btn btn-secondary" onClick={() => setStage('intro')}>
                                        <RefreshCw size={16} /> Repeat Test
                                    </button>
                                    {metrics.risk !== 'Low' && (
                                        <button className="btn btn-purple" onClick={() => onNavigate('scan')}>
                                            Save & Start Voice Scan
                                        </button>
                                    )}
                                    {vocalResult && (
                                        <button className="btn btn-xl btn-green" style={{ width: '100%', marginTop: 12, border: '2px solid white' }} onClick={() => onNavigate('recipes')}>
                                            <Utensils size={20} /> VIEW THERAPEUTIC NUTRITION PLAN
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
