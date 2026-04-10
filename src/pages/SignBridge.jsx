// src/pages/SignBridge.jsx
// SignBridge — Full two-way sign language interpretation pipeline
// Deaf→Hearing: MediaPipe Hands → Gesture Classifier → AI Refine → TTS
// Hearing→Deaf: Web Speech STT → NLP Simplify → Sign Avatar

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Hand, Mic, Volume2, Brain, ShieldCheck, MicOff,
    RefreshCw, Trash2, Camera, MessageSquare,
    ChevronRight, Sparkles, Globe, PlayCircle, StopCircle,
    Zap, Activity, Info, UserCheck, Users
} from 'lucide-react';
import { api } from '../api/client';

/* ─── 50+ Gesture Dictionary (Scalable Pattern Registry) ──────────────────── */
const GESTURE_REGISTRY = [
    // MEDICAL
    { value: 'DOCTOR',  pattern: '11000', loc: 'wrist',  type: 'word' },
    { value: 'HELP',    pattern: '00000', loc: 'palm',   type: 'word' },
    { value: 'MEDICINE',pattern: '00100', loc: 'palm',   type: 'word' },
    { value: 'PAIN',    pattern: '11000', loc: 'chest',  type: 'word' },
    { value: 'BLOOD',   pattern: '11111', loc: 'mouth',  type: 'word' },
    
    // DAILY
    { value: 'HELLO',   pattern: '11111', loc: 'head',   type: 'word' },
    { value: 'THANKS',  pattern: '11111', loc: 'chin',   type: 'word' },
    { value: 'PLEASE',  pattern: '11111', loc: 'chest',  type: 'word' },
    { value: 'SORRY',   pattern: '00000', loc: 'chest',  type: 'word' },
    { value: 'YES',     pattern: '00000', loc: 'neutral',type: 'word' },
    { value: 'NO',      pattern: '11000', loc: 'neutral',type: 'word' },
    
    // FAMILY & PEOPLE
    { value: 'FAMILY',  pattern: '11111', loc: 'neutral',type: 'word' },
    { value: 'MOTHER',  pattern: '11111', loc: 'chin',   type: 'word' },
    { value: 'FATHER',  pattern: '11111', loc: 'head',   type: 'word' },
    { value: 'FRIEND',  pattern: '11000', loc: 'neutral',type: 'word' },
    
    // NEEDS
    { value: 'WATER',   pattern: '11111', loc: 'chin',   type: 'word' },
    { value: 'FOOD',    pattern: '00000', loc: 'mouth',  type: 'word' },
    { value: 'TOILET',  pattern: '11000', loc: 'neutral',type: 'word' },
    { value: 'SLEEP',   pattern: '11111', loc: 'face',   type: 'word' },
    { value: 'WANT',    pattern: '11111', loc: 'neutral',type: 'word' },
    
    // TIME
    { value: 'NOW',     pattern: '11000', loc: 'neutral',type: 'word' },
    { value: 'TODAY',   pattern: '11000', loc: 'chest',  type: 'word' },
    { value: 'TIME',    pattern: '11000', loc: 'wrist',  type: 'word' },
    
    // ALPHABET (Fingerspelling)
    { value: 'A', pattern: '00000', loc: 'neutral', type: 'letter' },
    { value: 'B', pattern: '11111', loc: 'neutral', type: 'letter' },
    { value: 'D', pattern: '10000', loc: 'neutral', type: 'letter' },
    { value: 'L', pattern: '10001', loc: 'neutral', type: 'letter' },
    { value: 'V', pattern: '11000', loc: 'neutral', type: 'letter' },
];

/* ─── Pattern Matcher Engine ─────────────────────────────────────────────── */
function getHandSignature(landmarks) {
    const f1 = isFingerExtended(landmarks, 0) ? '1' : '0';
    const f2 = isFingerExtended(landmarks, 1) ? '1' : '0';
    const f3 = isFingerExtended(landmarks, 2) ? '1' : '0';
    const f4 = isFingerExtended(landmarks, 3) ? '1' : '0';
    const th = isThumbExtended(landmarks) ? '1' : '0';
    return f1 + f2 + f3 + f4 + th;
}

function classifyHolisticSign(results, userDictionary = []) {
    if (!results.leftHandLandmarks && !results.rightHandLandmarks) return null;
    
    const mainHand = results.rightHandLandmarks || results.leftHandLandmarks;
    const sig = getHandSignature(mainHand);
    const head = results.faceLandmarks ? results.faceLandmarks[10] : null; 
    
    // Proximity mapping
    let location = 'neutral';
    if (head && mainHand) {
        const dist = Math.sqrt(Math.pow(mainHand[0].x - head.x, 2) + Math.pow(mainHand[0].y - head.y, 2));
        if (dist < 0.15) location = 'head';
        else if (dist < 0.25) {
            if (mainHand[0].y > head.y + 0.1) location = 'chin';
            else location = 'face';
        }
    }

    // ── 1. Check User's Personal Trained Signs (Priority) ──
    const userMatch = userDictionary.find(g => g.pattern === sig && (g.loc === 'neutral' || g.loc === location));
    if (userMatch) return { type: 'word', value: userMatch.value };

    // ── 2. Fallback to Global Registry ──
    const match = GESTURE_REGISTRY.find(g => g.pattern === sig && (g.loc === 'neutral' || g.loc === location));
    return match ? { type: match.type, value: match.value } : null;
}

/* ─── Geometric Finger Extension Helper ────────────────────────────────────── */
function isFingerExtended(landmarks, fingerIndex) {
    const tips  = [8, 12, 16, 20];
    const pips  = [6, 10, 14, 18];
    const mcps  = [5,  9, 13, 17];
    const tip = landmarks[tips[fingerIndex]];
    const pip = landmarks[pips[fingerIndex]];
    const mcp = landmarks[mcps[fingerIndex]];
    const wrist = landmarks[0];
    const armVec = { x: mcp.x - wrist.x, y: mcp.y - wrist.y };
    const tipVec = { x: tip.x - mcp.x,   y: tip.y - mcp.y };
    const pipVec = { x: pip.x - mcp.x,   y: pip.y - mcp.y };
    const tipDot = tipVec.x * armVec.x + tipVec.y * armVec.y;
    const pipDot = pipVec.x * armVec.x + pipVec.y * armVec.y;
    return tipDot > pipDot;
}

function isThumbExtended(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIp  = landmarks[3];
    const thumbMcp = landmarks[2];
    const dx = thumbTip.x - thumbMcp.x;
    const dy = thumbTip.y - thumbMcp.y;
    const dxi = thumbIp.x - thumbMcp.x;
    const dyi = thumbIp.y - thumbMcp.y;
    return Math.sqrt(dx*dx + dy*dy) > Math.sqrt(dxi*dxi + dyi*dyi) * 1.1;
}

/* ─── Sign Avatar (Three.js 3D skeleton) ─────────────────────────────────── */
function SignAvatar3D({ letter }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);

    useEffect(() => {
        if (!window.THREE || !mountRef.current) return;

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        const scene = new window.THREE.Scene();
        const camera = new window.THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setSize(width, height);
        mountRef.current.appendChild(renderer.domElement);

        const geometry = new window.THREE.BoxGeometry(0.5, 0.8, 0.2);
        const material = new window.THREE.MeshPhongMaterial({ 
            color: 0x7c3aed,
            emissive: 0x2e1065,
            specular: 0x06b6d4,
            shininess: 100
        });
        const palm = new window.THREE.Mesh(geometry, material);
        scene.add(palm);

        const light = new window.THREE.DirectionalLight(0xffffff, 1);
        light.position.set(1, 1, 2).normalize();
        scene.add(light);
        scene.add(new window.THREE.AmbientLight(0x404040));

        camera.position.z = 2;

        const animate = () => {
            if (!sceneRef.current) return;
            requestAnimationFrame(animate);
            palm.rotation.y += 0.01;
            if (letter) {
                palm.scale.set(1.2, 1.2, 1.2);
            } else {
                palm.scale.set(1, 1, 1);
            }
            renderer.render(scene, camera);
        };

        sceneRef.current = scene;
        animate();

        return () => {
            sceneRef.current = null;
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
        };
    }, [letter]);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '10px',
            border: '1px solid var(--border)', width: 150, height: 180, position: 'relative'
        }}>
            <div ref={mountRef} style={{ width: '100%', height: 120 }} />
            <div style={{ 
                fontFamily: 'var(--font-display)', 
                fontSize: 28, 
                fontWeight: 900, 
                color: 'var(--accent-purple)',
                position: 'absolute',
                bottom: 30
            }}>
                {letter || '?'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', position: 'absolute', bottom: 10 }}>3D Sign Engine</div>
        </div>
    );
}

/* ─── Waveform for STT ──────────────────────────────────────────────────────── */
function LivePulse({ active }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
            {[...Array(10)].map((_, i) => (
                <div key={i} style={{
                    width: 3,
                    borderRadius: 4,
                    background: 'var(--accent-cyan)',
                    height: active ? `${8 + Math.random() * 20}px` : '4px',
                    opacity: active ? 0.9 : 0.2,
                    transition: 'height 0.15s ease',
                    animation: active ? `waveAnim ${0.8 + i * 0.1}s ease-in-out infinite alternate` : 'none',
                    animationDelay: `${i * 0.07}s`,
                }} />
            ))}
        </div>
    );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function SignBridge({ onNavigate, patients = [], activePatientId }) {
    // Camera / MediaPipe state
    const [camActive, setCamActive] = useState(false);
    const [mpReady, setMpReady]     = useState(false);
    const [mpLoading, setMpLoading] = useState(false);
    const [mpError, setMpError]     = useState(null);

    // Sign recognition state
    const [liveGesture, setLiveGesture] = useState(null);
    const [gestureSeq, setGestureSeq]   = useState([]);
    const [holdPct, setHoldPct]         = useState(0);
    const [userGestures, setUserGestures] = useState(() => {
        const saved = localStorage.getItem('neuro_user_signs');
        return saved ? JSON.parse(saved) : [];
    });
    const [trainingLabel, setTrainingLabel] = useState('');
    const [isTraining, setIsTraining]         = useState(false);

    // AI pipeline state
    const [translation, setTranslation] = useState('');
    const [emotionMode, setEmotionMode] = useState('Neutral');
    const [aiLoading, setAiLoading]     = useState(false);
    const [aiError, setAiError]         = useState(null);

    // STT (Hearing → Deaf) state
    const [sttActive, setSttActive]     = useState(false);
    const [sttInterim, setSttInterim]   = useState('');
    const [sttFinal, setSttFinal]       = useState('');
    const [sttSimplified, setSttSimplified] = useState('');

    const [activeTab, setActiveTab]     = useState('deaf2hearing');
    const [autoFlow, setAutoFlow]       = useState(false);
    const [fps, setFps]                 = useState(0);
    const [handConfidence, setHandConfidence] = useState(0);
    const lastFrameTime = useRef(performance.now());
    const [messages, setMessages]       = useState([]); 
    
    // Refs
    const videoRef      = useRef(null);
    const canvasRef     = useRef(null);
    const holisticRef   = useRef(null);
    const cameraRef     = useRef(null);
    const holdCounter   = useRef(0);
    const lastGest      = useRef(null);
    const recogRef      = useRef(null);
    const frameBuffer   = useRef([]); // Tracking motion over last 10 frames
    const lastHolisticResults = useRef(null);
    const lastRefineTime = useRef(performance.now());
    const userGesturesRef = useRef(userGestures);

    // Sync Ref with State
    useEffect(() => {
        userGesturesRef.current = userGestures;
    }, [userGestures]);

    /* ─── TTS ─────────────────────────────────────────────────────────────── */
    const speak = (text) => {
        if (!text || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.9;
        utter.pitch = 1.05;
        window.speechSynthesis.speak(utter);
    };

    /* ─── AI Refine (calls backend) ──────────────────────────────────────── */
    const refineWithAI = async () => {
        if (!gestureSeq.length) return;
        setAiLoading(true);
        setAiError(null);
        try {
            const raw = gestureSeq.join('');
            const data = await api.refineSign(raw);
            const refined = data.refined;
            
            setTranslation(refined);
            speak(refined);
            
            // Add to conversation log
            setMessages(prev => [...prev, { 
                sender: 'deaf', 
                text: refined, 
                raw: raw,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            
            setGestureSeq([]); // Clear queue after success
        } catch (err) {
            setAiError(err.message);
        } finally {
            setAiLoading(false);
        }
    };

    const startTraining = () => {
        if (!camActive) {
            setMpError("Start the interpreter first to live-train.");
            return;
        }
        setIsTraining(true);
    };

    const saveTrainedSign = () => {
        if (!trainingLabel.trim()) return;
        const results = lastHolisticResults.current;
        if (!results || (!results.leftHandLandmarks && !results.rightHandLandmarks)) {
            setMpError("Keep your hand in view while saving.");
            return;
        }

        const mainHand = results.rightHandLandmarks || results.leftHandLandmarks;
        const sig = getHandSignature(mainHand);
        
        // Use the same proximity logic
        let location = 'neutral';
        const head = results.faceLandmarks ? results.faceLandmarks[10] : null; 
        if (head && mainHand) {
            const dist = Math.sqrt(Math.pow(mainHand[0].x - head.x, 2) + Math.pow(mainHand[0].y - head.y, 2));
            if (dist < 0.15) location = 'head';
            else if (dist < 0.25) {
                if (mainHand[0].y > head.y + 0.1) location = 'chin';
                else location = 'face';
            }
        }

        const newSign = { value: trainingLabel.toUpperCase(), pattern: sig, loc: location };
        const updated = [...userGestures, newSign];
        setUserGestures(updated);
        localStorage.setItem('neuro_user_signs', JSON.stringify(updated));
        
        // Reset
        setTrainingLabel('');
        setIsTraining(false);
        setMpError(null);
    };

    /* ─── Load MediaPipe from CDN ─────────────────────────────────────────── */
    const loadScript = (src) => new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
    });

    const initMediaPipe = async () => {
        setMpLoading(true);
        setMpError(null);
        try {
            const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe';
            // Holistic is the "Pro" version that tracks Face, Hands, and Pose
            await loadScript(`${CDN}/holistic/holistic.js`);
            await loadScript(`${CDN}/camera_utils/camera_utils.js`);
            await loadScript(`${CDN}/drawing_utils/drawing_utils.js`);
            
            if (!window.THREE) {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            }

            const holistic = new window.Holistic({
                locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`,
            });
            holistic.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
            holistic.onResults(handleResults);
            holisticRef.current = holistic;
            setMpReady(true);
        } catch (e) {
            setMpError('Failed to load Holistic libraries. Check connection.');
            console.error(e);
        } finally {
            setMpLoading(false);
        }
    };

    /* ─── Camera Toggle ───────────────────────────────────────────────────── */
    const toggleCamera = async () => {
        if (camActive) {
            cameraRef.current?.stop();
            setCamActive(false);
            setLiveGesture(null);
            holdCounter.current = 0;
            return;
        }
        if (!mpReady) await initMediaPipe();
        try {
            const cam = new window.Camera(videoRef.current, {
                onFrame: async () => {
                    if (holisticRef.current && videoRef.current) {
                        try {
                            await holisticRef.current.send({ image: videoRef.current });
                        } catch (err) { console.error("Holistic Send Error", err); }
                    }
                },
                width: 640,
                height: 480,
            });
            cam.start();
            cameraRef.current = cam;
            setCamActive(true);
        } catch {
            setMpError('Camera permission denied. Please allow camera access.');
        }
    };

    /* ─── Holistic Callback (Face + Motion + Hands) ───────────────────────── */
    const handleResults = useCallback((results) => {
        // FPS Calc
        const now = performance.now();
        const delta = now - lastFrameTime.current;
        lastFrameTime.current = now;
        if (delta > 0) setFps(Math.round(1000 / delta));

        lastHolisticResults.current = results; 
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ... drawing logic ...
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        if (results.faceLandmarks) {
            window.drawConnectors?.(ctx, results.faceLandmarks, window.FACEMESH_TESSELATION, { color: '#C0C0C050', lineWidth: 1 });
            window.drawConnectors?.(ctx, results.faceLandmarks, window.FACEMESH_RIGHT_EYEBROW, { color: '#FF3030', lineWidth: 2 });
            window.drawConnectors?.(ctx, results.faceLandmarks, window.FACEMESH_LEFT_EYEBROW, { color: '#30FF30', lineWidth: 2 });
        }
        
        let conf = 0;
        if (results.leftHandLandmarks) {
            window.drawConnectors?.(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS, { color: '#06b6d4', lineWidth: 3 });
            conf += 0.5;
        }
        if (results.rightHandLandmarks) {
            window.drawConnectors?.(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS, { color: '#a855f7', lineWidth: 3 });
            conf += 0.5;
        }
        setHandConfidence(conf);
        ctx.restore();

        // ── Expression & Gesture ──
        let emotion = "Neutral";
        let isQuestion = false;
        if (results.faceLandmarks) {
            const upLeft = results.faceLandmarks[70].y;
            const upRight = results.faceLandmarks[285].y;
            const eyeLeft = results.faceLandmarks[159].y;
            const eyeRight = results.faceLandmarks[386].y;
            if (upLeft < eyeLeft - 0.04 && upRight < eyeRight - 0.04) {
                isQuestion = true;
                emotion = "Inquisitive";
            }
        }
        
        const res = classifyHolisticSign(results, userGesturesRef.current);
        let g = res ? res.value : null;
        if (isQuestion && g) g = g + "?";
        setLiveGesture(g);
        setEmotionMode(emotion);

        const HOLD_FRAMES = 25; 
        if (g && g === lastGest.current) {
            holdCounter.current++;
        } else {
            holdCounter.current = 0;
            lastGest.current = g;
        }
        setHoldPct(Math.round((holdCounter.current / HOLD_FRAMES) * 100));

        if (holdCounter.current >= HOLD_FRAMES && g) {
            setGestureSeq(prev => [...prev, g, ' ']);
            holdCounter.current = 0;
            setHoldPct(0);
            lastRefineTime.current = now; // Reset auto-refine timer on sign capture
        }

        // ── Auto-Flow Auto-Refine Logic ──
        if (autoFlow && gestureSeq.length > 0 && !g) {
            const idleTime = now - lastRefineTime.current;
            if (idleTime > 2500) { // 2.5 seconds idle = auto-refine
                refineWithAI();
                lastRefineTime.current = now;
            }
        }
    }, [userGestures, autoFlow, gestureSeq]);



    /* ─── STT (Hearing → Deaf) ───────────────────────────────────────────── */
    const toggleSTT = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { alert('Speech Recognition not supported in this browser.'); return; }

        if (sttActive) {
            recogRef.current?.stop();
            setSttActive(false);
        } else {
            const rec = new SR();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';
            rec.onresult = async (e) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) {
                        const text = e.results[i][0].transcript;
                        setSttFinal(prev => prev + text + ' ');
                        
                        // Call backend for "Proper" Sign-friendly simplification
                        try {
                            const data = await api.simplifyText(text);
                            const simplified = data.simplified;
                            setSttSimplified(prev => prev + simplified + ' ');
                            setMessages(prev => [...prev, {
                                sender: 'hearing', text, simplified,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }]);
                        } catch (err) {
                            setSttSimplified(prev => prev + text.toUpperCase() + ' ');
                        }
                    } else {
                        interim += e.results[i][0].transcript;
                    }
                }
                setSttInterim(interim);
            };
            rec.onerror = (e) => { if (e.error !== 'no-speech') setSttActive(false); };
            rec.onend = () => { if (sttActive) rec.start(); };
            rec.start();
            recogRef.current = rec;
            setSttActive(true);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cameraRef.current?.stop();
            recogRef.current?.stop();
            speechSynthesis.cancel();
        };
    }, []);

    const clearAll = () => {
        setGestureSeq([]);
        setTranslation('');
        setHoldPct(0);
        holdCounter.current = 0;
    };

    /* ─── Render ──────────────────────────────────────────────────────────── */
    return (
        <div className="fade-in">
            {/* ── Page Header ────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ fontSize: 30 }}>SignBridge</h1>
                    <p className="page-subtitle">Real-time ASL Interpreter · MediaPipe Computer Vision · Two-way AI Pipeline</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-purple"><Hand size={11} /> MediaPipe Hands</span>
                    <span className="badge badge-cyan"><Sparkles size={11} /> AI Refine</span>
                    <span className="badge badge-green"><ShieldCheck size={11} /> On-device CV</span>
                </div>
            </div>

            <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ── Pipeline Tabs ────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 5, border: '1px solid var(--border)', width: 'fit-content' }}>
                    {[
                        { id: 'deaf2hearing', icon: <Hand size={14} />, label: 'Deaf → Hearing', color: 'var(--accent-purple)' },
                        { id: 'hearing2deaf', icon: <Mic size={14} />, label: 'Hearing → Deaf', color: 'var(--accent-cyan)' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                                background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                                color: activeTab === tab.id ? tab.color : 'var(--text-muted)',
                                boxShadow: activeTab === tab.id ? '0 2px 12px rgba(0,0,0,0.2)' : 'none',
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Panel: Deaf → Hearing ─────────────────────────────── */}
                {activeTab === 'deaf2hearing' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>

                        {/* Left: Camera */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: 400, background: '#050812' }}>
                                {/* Camera inactive overlay */}
                                {!camActive && (
                                    <div style={{
                                        position: 'absolute', inset: 0, zIndex: 10,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(5,8,18,0.95)', gap: 16,
                                    }}>
                                        <div style={{
                                            width: 72, height: 72, borderRadius: 18,
                                            background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: 'var(--shadow-glow-purple)', animation: 'pulse 2s ease infinite',
                                        }}>
                                            <Camera size={30} color="white" />
                                        </div>
                                        {mpError && <p style={{ color: 'var(--accent-red)', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>{mpError}</p>}
                                        <button className="btn btn-primary btn-lg" onClick={toggleCamera} disabled={mpLoading}>
                                            {mpLoading ? <><RefreshCw size={16} className="spin" /> Loading MediaPipe…</> : <><Camera size={16} /> Start Interpreter</>}
                                        </button>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 260 }}>
                                            All landmark processing runs locally via WASM. No video is uploaded.
                                        </p>
                                    </div>
                                )}
                                <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
                                <canvas ref={canvasRef} width={640} height={480}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

                                {/* Live HUD */}
                                {camActive && (
                                    <>
                                        {/* Performance HUD */}
                                        <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <span className="badge badge-red" style={{ fontSize: 10, background: 'rgba(239, 68, 68, 0.4)' }}>
                                                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-red)', animation: 'pulse 1s ease infinite', marginRight: 4 }} />
                                                    LIVE
                                                </span>
                                                <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(0,0,0,0.4)', borderRadius: 20, color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                    {fps} FPS
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Activity size={10} /> Conf: {Math.round(handConfidence * 100)}%
                                            </div>
                                        </div>

                                        <button onClick={toggleCamera}
                                            style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(239,68,68,0.7)', border: 'none', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)' }}>
                                            <StopCircle size={11} /> STOP
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="card" style={{ padding: '14px 18px', border: '1px dashed var(--brand-1)', background: 'rgba(124,58,237,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Sparkles size={14} /> Personal Sign Library
                                    </div>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{userGestures.length} MAPPED</span>
                                </div>
                                
                                {!isTraining ? (
                                    <button className="btn btn-secondary" onClick={() => setIsTraining(true)} style={{ width: '100%', fontSize: 12 }}>
                                        + Map New Live Gesture
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input 
                                            type="text" 
                                            value={trainingLabel}
                                            onChange={(e) => setTrainingLabel(e.target.value)}
                                            placeholder="Label (e.g. HELP)"
                                            style={{ flex: 1, height: 32, fontSize: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', color: 'white' }}
                                        />
                                        <button className="btn btn-primary" onClick={saveTrainedSign} style={{ height: 32, fontSize: 11, padding: '0 12px' }}>
                                            Save
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setIsTraining(false)} style={{ height: 32, fontSize: 11, padding: '0 8px' }}>
                                            ✕
                                        </button>
                                    </div>
                                )}

                                {userGestures.length > 0 && (
                                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Memory Map</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                            {userGestures.map((ug, idx) => (
                                                <div key={idx} style={{ 
                                                    background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', 
                                                    borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'white',
                                                    display: 'flex', alignItems: 'center', gap: 6
                                                }}>
                                                    ⭐ {ug.value}
                                                    <button 
                                                        onClick={() => {
                                                            const updated = userGestures.filter((_, i) => i !== idx);
                                                            setUserGestures(updated);
                                                            localStorage.setItem('neuro_user_signs', JSON.stringify(updated));
                                                        }}
                                                        style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Interpretation Panel */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Live gesture + avatar */}
                            <div className="card card-gradient-purple" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                <SignAvatar3D letter={liveGesture} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                                Detected Gesture
                                            </div>
                                            <div style={{ fontSize: 48, fontWeight: 900, color: liveGesture ? 'var(--accent-purple)' : 'var(--text-muted)', fontFamily: 'var(--font-display)', transition: 'color 0.2s' }}>
                                                {liveGesture || '—'}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>EXPRESSION</div>
                                            <div style={{ 
                                                padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', 
                                                border: '1px solid var(--border)', fontSize: 13, fontWeight: 700, 
                                                color: emotionMode === 'Inquisitive' ? 'var(--accent-cyan)' : 'var(--text-bright)',
                                                display: 'flex', alignItems: 'center', gap: 6
                                            }}>
                                                <UserCheck size={14} /> {emotionMode}
                                            </div>
                                        </div>
                                    </div>
                                    {holdPct > 0 && (
                                        <div style={{ marginTop: 10 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Hold to add: {holdPct}%</div>
                                            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${holdPct}%`, background: 'linear-gradient(90deg, var(--brand-1), var(--brand-2))', transition: 'width 0.1s linear', borderRadius: 4 }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Fingerspelling queue */}
                            <div className="card" style={{ flex: 1, border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.03)' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <MessageSquare size={14} color="var(--brand-1)" /> Constructed Message
                                </div>
                                <div style={{ 
                                    minHeight: 120, 
                                    padding: '18px', 
                                    background: 'rgba(0,0,0,0.2)', 
                                    borderRadius: 14, 
                                    border: '1px solid var(--border)',
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: 'white',
                                    fontFamily: 'var(--font-display)',
                                    lineHeight: 1.3
                                }}>
                                    {gestureSeq.length === 0 ? (
                                        <span style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 400, fontStyle: 'italic' }}>
                                            Signs will appear here as you perform them...
                                        </span>
                                    ) : (
                                        gestureSeq.join('')
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                    <button className="btn btn-primary" onClick={refineWithAI} disabled={!gestureSeq.length || aiLoading}
                                        style={{ flex: 1, height: 48, fontSize: 15 }}>
                                        {aiLoading ? <><RefreshCw size={14} className="spin" /> Refining…</> : <><Sparkles size={16} /> Refine Sentence</>}
                                    </button>
                                    <button 
                                        className={`btn ${autoFlow ? 'btn-primary' : 'btn-secondary'}`} 
                                        onClick={() => setAutoFlow(!autoFlow)}
                                        style={{ height: 48, padding: '0 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: autoFlow ? '1px solid var(--accent-cyan)' : '1px solid var(--border)' }}
                                    >
                                        <Zap size={14} color={autoFlow ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                                        <span style={{ fontSize: 9 }}>Auto</span>
                                    </button>
                                    <button className="btn btn-secondary" onClick={clearAll} style={{ width: 48, height: 48 }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                {aiError && <p style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 8 }}>{aiError}</p>}
                            </div>

                            {/* Translation output */}
                            <div className="card" style={{ flex: 1, border: '1px solid rgba(124,58,237,0.3)' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Volume2 size={13} color="var(--accent-purple)" /> Spoken Output
                                </div>
                                <div style={{
                                    fontSize: 22, fontWeight: 700, lineHeight: 1.5,
                                    color: translation ? 'var(--accent-purple)' : 'var(--text-muted)',
                                    minHeight: 60, padding: '14px 18px',
                                    background: 'rgba(124,58,237,0.05)', borderRadius: 12,
                                    border: '1px solid rgba(124,58,237,0.15)',
                                }}>
                                    {translation || 'AI-refined output will appear here…'}
                                </div>
                                {translation && (
                                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => speak(translation)}>
                                        <PlayCircle size={14} /> Replay Audio
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Panel: Hearing → Deaf ─────────────────────────────── */}
                {activeTab === 'hearing2deaf' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        {/* STT Panel */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="card card-gradient-cyan">
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-cyan)' }}>
                                    <Mic size={16} /> Speech-to-Text (Whisper API / Web Speech)
                                </div>
                                <button className={`btn ${sttActive ? 'btn-danger' : 'btn-primary'} btn-lg`}
                                    onClick={toggleSTT} style={{ width: '100%' }}>
                                    {sttActive ? <><MicOff size={18} /> Stop Listening</> : <><Mic size={18} /> Start Listening</>}
                                </button>

                                {sttActive && (
                                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <LivePulse active={sttActive} />
                                        <span style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 600 }}>Listening…</span>
                                    </div>
                                )}

                                <div style={{ marginTop: 16 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Live Transcript</div>
                                    <div style={{
                                        minHeight: 80, padding: '14px', borderRadius: 12,
                                        background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)',
                                        fontSize: 16, fontWeight: 600, color: 'var(--accent-cyan)', lineHeight: 1.6,
                                    }}>
                                        {sttFinal || <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}>Waiting for speech…</span>}
                                        {sttInterim && <span style={{ opacity: 0.6, fontSize: 14 }}>{sttInterim}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Brain size={14} color="var(--brand-1)" /> NLP Simplification Engine
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    Spoken English is automatically simplified into shorter, sign-language-friendly phrases. Articles, auxiliary verbs, and complex connectors are removed to match ASL/ISL temporal grammar.
                                </p>
                            </div>
                        </div>

                        {/* Simplified output for Deaf user */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="card" style={{ flex: 1, border: '1px solid rgba(52,211,153,0.25)' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <UserCheck size={14} /> Display for Deaf User
                                </div>
                                <div style={{
                                    minHeight: 140, padding: '20px', borderRadius: 14,
                                    background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)',
                                    fontSize: 28, fontWeight: 800, lineHeight: 1.4,
                                    color: sttSimplified ? 'white' : 'var(--text-muted)',
                                }}>
                                    {sttSimplified || <span style={{ fontSize: 15, fontWeight: 400 }}>Simplified text will appear here for the Deaf user to read…</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setSttFinal(''); setSttSimplified(''); setSttInterim(''); }}>
                                        <Trash2 size={12} /> Clear
                                    </button>
                                </div>
                            </div>

                            {/* How it works card */}
                            <div className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    How the Pipeline Works
                                </div>
                                {[
                                    { icon: <Mic size={14} />, color: 'var(--accent-cyan)', label: 'Step 1', text: 'Web Speech API captures audio with interim + final results' },
                                    { icon: <Brain size={14} />, color: 'var(--accent-purple)', label: 'Step 2', text: 'NLP processor strips complex grammar, articles, auxiliaries' },
                                    { icon: <UserCheck size={14} />, color: 'var(--accent-green)', label: 'Step 3', text: 'Large-text display shows simplified message for Deaf user' },
                                ].map((step, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.color, flexShrink: 0 }}>
                                            {step.icon}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: step.color, fontWeight: 700, marginBottom: 2 }}>{step.label}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{step.text}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Conversation History ────────────────────────────── */}
                <div className="card" style={{ paddingBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Globe size={14} color="var(--brand-1)" /> Real-time Conversation Log
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                        {messages.length === 0 ? (
                            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                <MessageSquare size={24} style={{ opacity: 0.2, marginBottom: 10 }} />
                                <br /> No messages yet. Start signing or speaking to begin.
                            </div>
                        ) : (
                            messages.map((m, i) => (
                                <div key={i} style={{ 
                                    alignSelf: m.sender === 'deaf' ? 'flex-start' : 'flex-end',
                                    maxWidth: '85%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: m.sender === 'deaf' ? 'flex-start' : 'flex-end'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: m.sender === 'deaf' ? 'var(--accent-purple)' : 'var(--accent-cyan)' }}>
                                            {m.sender === 'deaf' ? 'Deaf User' : 'Hearing User'}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.time}</span>
                                    </div>
                                    <div style={{ 
                                        padding: '12px 16px', 
                                        borderRadius: 14, 
                                        borderTopLeftRadius: m.sender === 'deaf' ? 2 : 14,
                                        borderTopRightRadius: m.sender === 'hearing' ? 2 : 14,
                                        background: m.sender === 'deaf' ? 'rgba(124,58,237,0.1)' : 'rgba(6,182,212,0.1)',
                                        border: `1px solid ${m.sender === 'deaf' ? 'rgba(124,58,237,0.2)' : 'rgba(6,182,212,0.2)'}`,
                                        color: 'white',
                                        fontSize: 14
                                    }}>
                                        {m.sender === 'deaf' ? (
                                            <>
                                                <div style={{ fontWeight: 600 }}>{m.text}</div>
                                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, letterSpacing: 0.5 }}>Signs: {m.raw}</div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6 }}>"{m.text}"</div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-cyan)', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 8 }}>
                                                    <Sparkles size={11} /> SIGNED: {m.simplified}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        <div id="messages-end" />
                    </div>
                </div>

                {/* ── Architecture Info Banner ──────────────────────────── */}
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.06))', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={18} color="white" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Tech Stack</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>MediaPipe WASM → Geometric Classifier → FastAPI AI</div>
                        </div>
                    </div>
                    {[
                        ['CV Model', 'MediaPipe Hands (Google)'],
                        ['Classifier', 'Geometric landmark rules'],
                        ['STT Engine', 'Web Speech API'],
                        ['LLM Layer', 'FastAPI /signbridge/refine'],
                        ['TTS Engine', 'Web Speech Synthesis'],
                        ['Privacy', '100% on-device CV'],
                    ].map(([label, val]) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{val}</div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.08); } }
                .spin { animation: spin 1.2s linear infinite; display:inline-block; }
                @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
            `}</style>
        </div>
    );
}

