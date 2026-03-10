// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Activity, TrendingUp, Users, AlertCircle, Brain, ArrowUpRight, Mic, Calendar, Watch, Trophy, ChevronRight, Zap, Smartphone, Utensils, Heart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';
import { api, checkBackendHealth } from '../api/client';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--brand-2)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
                <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)' }}>Brain Score: {payload[0].value}</p>
            </div>
        );
    }
    return null;
};

export default function Dashboard({
    onNavigate,
    activePatientId,
    activePage
}) {
    const [animIn, setAnimIn] = useState(false);
    const [stats, setStats] = useState([]);
    const [history, setHistory] = useState([]);
    const [motorHistory, setMotorHistory] = useState([]);
    const [patient, setPatient] = useState(null);

    useEffect(() => {
        setTimeout(() => setAnimIn(true), 100);
    }, []);

    useEffect(() => {
        if (!activePatientId) return;

        let isMounted = true;
        const fetchData = async () => {
            try {
                const result = await api.getPatient(activePatientId);
                if (!result || !isMounted) return;

                const { patient: pData, sessions = [], motor_sessions = [] } = result;
                setPatient(pData);
                setMotorHistory(motor_sessions.map(m => ({
                    date: new Date(m.recorded_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                    speed: m.stability_idx,
                    irregularity: (100 - m.accuracy_pct).toFixed(1),
                    label: m.label
                })).slice(0, 5));

                if (sessions && sessions.length > 0) {
                    const chartData = [...sessions].reverse().slice(-7).map(s => ({
                        day: new Date(s.recorded_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                        score: Math.round(s.risk_score || 0),
                        risk: s.risk_label || 'Unknown',
                        fo: s.fo_mean?.toFixed(1) || '—',
                        jitter: s.jitter_local ? (s.jitter_local * 100).toFixed(2) + '%' : '—',
                        shimmer: s.shimmer_local ? (s.shimmer_local * 100).toFixed(2) + '%' : '—',
                        hnr: s.hnr?.toFixed(1) || '—'
                    }));
                    setHistory(chartData);

                    const latest = sessions[0];
                    const latestMotor = motor_sessions[0];

                    setStats([
                        { label: 'Risk Score', value: Math.round(latest.risk_score || 0), unit: '/100', change: 'Live from AI', trend: (latest.risk_score || 0) > 50 ? 'down' : 'up', icon: Brain, color: 'var(--accent-purple)', bg: 'rgba(168,85,247,0.12)' },
                        { label: 'Vocal Health', value: latest.risk_label || 'N/A', unit: '', change: 'Clinical Index', trend: 'up', icon: Mic, color: latest.risk_label === 'Low' ? 'var(--accent-green)' : 'var(--accent-amber)', bg: 'rgba(34,211,238,0.10)' },
                        { label: 'Motor Status', value: latestMotor ? latestMotor.label.split(' ')[0] : 'None', unit: '', change: latestMotor ? 'Latest Test' : 'No Test', trend: 'up', icon: Activity, color: (latestMotor && latestMotor.label.includes('Healthy')) ? 'var(--accent-green)' : 'var(--accent-amber)', bg: 'rgba(52,211,153,0.10)' },
                        { label: 'Stability', value: latest.jitter_local ? (100 - (latest.jitter_local * 1000)).toFixed(1) : '—', unit: '%', change: 'Stability', trend: 'up', icon: TrendingUp, color: 'var(--accent-green)', bg: 'rgba(52,211,153,0.10)' },
                    ]);
                } else {
                    setHistory([]);
                    setStats([
                        { label: 'Risk Score', value: '—', unit: '', change: 'No Data', trend: 'up', icon: Brain, color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
                        { label: 'Total Scans', value: '0', unit: '', change: 'Start Now', trend: 'up', icon: Mic, color: 'var(--accent-cyan)', bg: 'rgba(34,211,238,0.10)' },
                        { label: 'Status', value: 'Idle', unit: '', change: 'Ready', trend: 'up', icon: Activity, color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
                        { label: 'Vocal Stability', value: '—', unit: '', change: 'No Data', trend: 'up', icon: TrendingUp, color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
                    ]);
                }
            } catch (err) {
                console.error("Dashboard error:", err);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [activePatientId, activePage]);

    const quickActions = [
        { id: 'scan', label: 'Start Voice Scan', desc: 'Analyze biomarkers now', icon: Mic, color: 'var(--brand-1)' },
        { id: 'appointment', label: 'AI Triage Bot', desc: 'Find & book a doctor', icon: Calendar, color: 'var(--accent-cyan)' },
        { id: 'recipes', label: 'Recipe Maker', desc: '50+ Therapeutic meals', icon: Utensils, color: 'var(--accent-green)' },
        { id: 'braingym', label: 'Brain Gym', desc: 'Cognitive Daily Drills', icon: Trophy, color: 'var(--accent-amber)' },
    ];

    if (!activePatientId) {
        return (
            <div className="fade-in" style={{ textAlign: 'center', marginTop: 100 }}>
                <Users size={64} color="var(--text-muted)" style={{ marginBottom: 20 }} />
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>No Patient Profile Active</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Please register or select a patient to view clinical analytics.</p>
                <button className="btn btn-primary" onClick={() => onNavigate('patients')}>Go to Patient Registry</button>
            </div>
        );
    }

    return (
        <div className={animIn ? 'fade-in' : ''} style={{ opacity: animIn ? 1 : 0 }}>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Welcome Back, {patient?.name || 'User'}</h1>
                    <p className="page-subtitle">Your neurological health summary · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <button className="btn btn-primary" onClick={() => onNavigate('scan')}>
                    <Mic size={16} /> Start Today&apos;s Scan
                </button>
            </div>

            <div className="page-body">
                {/* Stats */}
                <div className="stats-grid">
                    {stats.map((s, i) => (
                        <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="stat-icon-wrap" style={{ background: s.bg }}>
                                <s.icon size={22} color={s.color} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="stat-value" style={{ color: s.color }}>
                                    {s.value}<span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{s.unit}</span>
                                </div>
                                <div className="stat-label">{s.label}</div>
                                <div className={`stat-change ${s.trend}`}>
                                    <ArrowUpRight size={11} /> {s.change}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chart + Quick Actions */}
                <div className="grid-2" style={{ gap: 24, marginBottom: 24 }}>
                    {/* Chart */}
                    <div className="card">
                        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <TrendingUp size={18} color="var(--accent-cyan)" />
                                <span className="accent">Brain Health Score — Trend</span>
                            </div>
                            <div className="badge badge-cyan">CLINICAL V2.0</div>
                        </div>
                        {history.length > 0 ? (
                            <div style={{ position: 'relative' }}>
                                <ResponsiveContainer width="100%" height={240}>
                                    <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                        <XAxis dataKey="day" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            stroke="var(--accent-cyan)"
                                            strokeWidth={4}
                                            fill="url(#scoreGrad)"
                                            dot={{ fill: 'var(--accent-cyan)', r: 5, strokeWidth: 2, stroke: 'var(--bg-primary)' }}
                                            activeDot={{ r: 8, stroke: 'white', strokeWidth: 3 }}
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.03, pointerEvents: 'none' }}>
                                    <Brain size={180} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                                No scan history yet. Complete a scan to see trends.
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Nutrition Card */}
                        <div className="card card-gradient-green" style={{ padding: 20 }}>
                            <div className="section-title" style={{ marginBottom: 12, fontSize: 16 }}>
                                <Utensils size={16} color="var(--accent-green)" />
                                Precision Nutrition AI
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ background: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 14 }}>
                                    <Heart size={32} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>Healthy for Parkinson's</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                                        50+ Bio-active recipes discovered for your specific condition.
                                    </div>
                                </div>
                                <button className="btn btn-white btn-xs" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('recipes')}>
                                    Explore
                                </button>
                            </div>
                        </div>

                        <div className="card" style={{ flex: 1 }}>
                            <div className="section-title">
                                <Zap size={18} color="var(--accent-amber)" />
                                Quick Actions
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {quickActions.map(a => (
                                    <button key={a.id} className="appointment-card" style={{ width: '100%', textAlign: 'left', background: 'none', padding: '12px 14px' }} onClick={() => onNavigate(a.id)}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${a.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <a.icon size={16} color={a.color} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{a.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{a.desc}</div>
                                        </div>
                                        <ChevronRight size={14} color="var(--text-muted)" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Biomarker Table */}
                <div className="card">
                    <div className="section-title">
                        <Activity size={18} color="var(--accent-purple)" />
                        Recent Biomarker Readings
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    {['Date', 'Freq (F0)', 'Jitter (Instability)', 'Shimmer (leakage)', 'Clarity (HNR)', 'Risk'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {history.length > 0 ? history.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{r.day}</td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent-cyan)' }}>{r.fo} Hz</td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent-purple)' }}>{r.jitter}</td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)' }}>{r.shimmer}</td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>{r.hnr} dB</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span className={`badge badge-${r.risk === 'Low' ? 'green' : r.risk === 'Medium' ? 'amber' : 'red'}`}>{r.risk}</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No biomarker data available yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Motor History Table */}
                <div className="card">
                    <div className="section-title">
                        <Smartphone size={18} color="var(--accent-purple)" />
                        Recent Motor Assessments
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    {['Date', 'Tapping Speed', 'Irregularity', 'Clinical Guess'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {motorHistory.length > 0 ? motorHistory.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{r.date}</td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent-purple)' }}>{r.speed} taps/s</td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)' }}>{r.irregularity}%</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span className="badge badge-cyan">{r.label}</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No motor assessments yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

