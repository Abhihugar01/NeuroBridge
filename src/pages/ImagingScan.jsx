import { useState, useRef } from 'react';
import { ShieldCheck, Upload, Zap, Brain, AlertCircle, CheckCircle, Info, ChevronRight, Loader, Utensils } from 'lucide-react';
import { api } from '../api/client';

export default function ImagingScan({ patients, activePatientId, onNavigate }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const activePatient = patients.find(p => p.id === activePatientId) || patients[0];

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
            setResult(null);
            setError(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const data = await api.analyzeImaging(activePatientId, file);
            setResult(data);
        } catch (err) {
            setError(err.message || "Failed to analyze image. Ensure it's a valid brain scan.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🧠 Radiological AI Scan</h1>
                    <p className="page-subtitle">Computer Vision Analysis of DaT Scans (Striatal Binding Ratio)</p>
                </div>
                <div className="badge badge-purple">CV-ENGINE V1.2</div>
            </div>

            <div className="page-body" style={{ maxWidth: 900, margin: '0 auto' }}>
                {!result ? (
                    <div className="grid-2">
                        {/* 1. Upload Section */}
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, border: '2px dashed var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                            {preview ? (
                                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <img src={preview} alt="Scan Preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 12, boxShadow: '0 0 30px rgba(0,0,0,0.5)' }} />
                                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => { setFile(null); setPreview(null); }}>Remove Image</button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => fileInputRef.current.click()}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <Upload size={32} color="var(--brand-1)" />
                                    </div>
                                    <p style={{ fontWeight: 700, fontSize: 16 }}>Upload Patient Scan</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Supports JPG, PNG (DaT Heatmaps)</p>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                        </div>

                        {/* 2. Selection & Action */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div className="card card-gradient-cyan">
                                <div className="section-title"><ShieldCheck size={16} color="var(--accent-cyan)" /> Imaging Protocol</div>
                                <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.8 }}>
                                    <li>Provide a coronal or transverse slice of the <strong>DaT Scan</strong>.</li>
                                    <li>Ensure brain hemispheres are centered in the frame.</li>
                                    <li>The AI uses <strong>Striatal Binding Ratio (SBR)</strong> templates to detect dopaminergic loss.</li>
                                </ul>
                            </div>

                            <div className="card">
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Scanning for Patient:</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>{activePatient?.name[0]}</div>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{activePatient?.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: #{activePatient?.id} • Age: {activePatient?.age}</div>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-primary btn-xl"
                                    style={{ width: '100%' }}
                                    onClick={handleAnalyze}
                                    disabled={!file || loading}
                                >
                                    {loading ? <><Loader className="spin" size={18} /> Analyzing...</> : <><Zap size={18} /> Start AI Image Analysis</>}
                                </button>
                                {error && (
                                    <div className="alert alert-danger" style={{ marginTop: 16 }}>
                                        <AlertCircle size={16} /> <div>{error}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="fade-in">
                        <div className="grid-2">
                            {/* Result Display */}
                            <div className="card" style={{ background: '#0a0a0c', border: '1px solid #1f1f23' }}>
                                <div className="section-title"><Brain size={16} color="var(--accent-purple)" /> Digital Lightbox Analysis</div>
                                <div style={{ position: 'relative', textAlign: 'center', py: 20 }}>
                                    <img src={preview} alt="Scan Result" style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, filter: 'brightness(1.1) contrast(1.2)' }} />
                                    {/* Simulated CV overlay */}
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '2px dashed var(--accent-cyan)', width: '60%', height: '40%', opacity: 0.4 }}></div>
                                </div>
                                <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, fontSize: 13, borderLeft: '4px solid var(--accent-cyan)' }}>
                                    {result.findings}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div className="card card-gradient-purple" style={{ textAlign: 'center', padding: '30px 20px' }}>
                                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>Striatal Binding Ratio (SBR)</div>
                                    <div style={{ fontSize: 56, fontWeight: 900, color: result.sbr_ratio > 1.1 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{result.sbr_ratio}</div>
                                    <div className={`badge badge-${result.risk_score > 50 ? 'red' : 'green'}`} style={{ marginTop: 10 }}>{result.status}</div>

                                    <div style={{ mt: 20, pt: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-around' }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ASYMMETRY</div>
                                            <div style={{ fontWeight: 700 }}>{result.asymmetry}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PUTAMEN LOSS</div>
                                            <div style={{ fontWeight: 700, color: result.putamen_reduction === 'Detected' ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{result.putamen_reduction}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="card">
                                    <div className="section-title"><CheckCircle size={16} color="var(--accent-green)" /> Medical Verification</div>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        This analysis has been digitally signed into the patient file. Your fusion report now includes <strong>radiological domain</strong> data.
                                    </p>
                                    <button
                                        className="btn btn-primary"
                                        style={{ width: '100%', marginTop: 20 }}
                                        onClick={() => onNavigate('recipes')}
                                    >
                                        Explore Brain-Specific Diets <Utensils size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card" style={{ marginTop: 30 }}>
                    <div className="section-title"><Info size={16} color="var(--accent-cyan)" /> How AI Analyzes Brain Scans</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginTop: 10 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>1. Heatmap Segmentation</div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', mt: 4 }}>Isolates the red-spectrum pixels identifying high-uptake regions in the Striatum.</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>2. Striatal Morphology</div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', mt: 4 }}>Detects the circularity of the uptake. A 'round' dot indicates loss of the Putamen comma-tail.</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>3. Comparative Ratio</div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', mt: 4 }}>Compares intensity against standard control templates for age-matched normalcy.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
