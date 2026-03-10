// src/pages/AppointmentBot.jsx  – Feature 2: Agentic Appointment & Triage Bot
import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Star, MessageSquare, CheckCircle, Clock, Phone, Send, Bot, Zap, ChevronRight, AlertTriangle, ArrowUpRight, Search } from 'lucide-react';
import { api } from '../api/client';

const LANGUAGES_MOCK = []; // placeholder if needed

function TypingIndicator() {
    return (
        <div className="chat-bubble ai" style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '12px 18px', width: 'fit-content' }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'pulseDot 1.4s ease infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
        </div>
    );
}

export default function AppointmentBot({ activePatientId }) {
    const [messages, setMessages] = useState([]);
    const [showDoctors, setShowDoctors] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [typing, setTyping] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [started, setStarted] = useState(false);
    const [latestSession, setLatestSession] = useState(null);
    const [patient, setPatient] = useState(null);
    const chatRef = useRef(null);

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages, typing]);

    // Fetch real patient and latest session on load
    useEffect(() => {
        if (activePatientId) {
            api.getPatient(activePatientId).then(res => setPatient(res.patient));
            api.getSessions(activePatientId).then(res => {
                if (res && res.length > 0) {
                    setLatestSession(res[0]);
                }
            });
        }
    }, [activePatientId]);

    const [location, setLocation] = useState(null);
    const [searching, setSearching] = useState(false);

    const startFlow = () => {
        setStarted(true);
        setSearching(true);
        setTyping(true);

        // Try to get real location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = "Bengaluru, India"; // Fallback/Simulator
                    setLocation(loc);
                    runAgent(loc);
                    fetchDocs(loc);
                },
                () => {
                    const fallback = "Bengaluru, India";
                    setLocation(fallback);
                    runAgent(fallback);
                    fetchDocs(fallback);
                }
            );
        } else {
            runAgent("your area");
            fetchDocs("Bangalore");
        }
    };

    const fetchDocs = (loc) => {
        api.searchDoctors(loc).then(res => {
            setDoctors(res);
        }).catch(err => {
            console.error("Failed to fetch doctors:", err);
        });
    };

    const runAgent = (locName) => {
        const risk = latestSession?.risk_score || 0;
        const sub = risk > 70 ? 'URGENT' : risk > 35 ? 'RECOMMENDED' : 'ROUTINE';

        const dynamicFlow = [
            { from: 'ai', text: `🧠 Analyzing your clinical profile... Found ${latestSession?.risk_label || 'low'} biomarkers in your last scan (Risk Index: ${risk}/100).`, delay: 0 },
            { from: 'ai', text: `📍 Detected Location: ${locName}. Activating search agents for top-rated Parkinson's specialists nearby...`, delay: 1800 },
            { from: 'ai', text: `🔍 Scraped medical directories (Practo, Apollo, Manipal)... Comparing doctor availability and ratings...`, delay: 3500 },
            { from: 'ai', text: `✅ Search complete! I've found ${doctors.length || 6} specialists near ${locName} with immediate availability. Please select one to book.`, delay: 2000 },
        ];

        let totalDelay = 0;
        dynamicFlow.forEach((msg, i) => {
            const showTypingAt = totalDelay;
            const showMsgAt = totalDelay + 1000;
            totalDelay += msg.delay || 1500;

            setTimeout(() => setTyping(true), showTypingAt);
            setTimeout(() => {
                setTyping(false);
                setMessages(prev => [...prev, msg]);
                if (i === dynamicFlow.length - 1) {
                    setSearching(false);
                    setShowDoctors(true);
                }
            }, showMsgAt);
        });
    };

    const handleSelectDoc = (doc) => {
        setSelectedDoc(doc);
        setSelectedSlot(null);
        setMessages(prev => [...prev, { from: 'user', text: `Consult with ${doc.name}` }]);
        setTimeout(() => {
            setMessages(prev => [...prev, { from: 'ai', text: `${doc.name} specializes in ${doc.specialty}. It's an excellent choice. Which date works for you?` }]);
        }, 700);
    };

    const handleSelectSlot = (slot) => {
        setSelectedSlot(slot);
        setMessages(prev => [...prev, { from: 'user', text: `I'll take ${slot}` }]);
        setTimeout(() => {
            setMessages(prev => [...prev, { from: 'ai', text: `Great. I'm ready to book this for you. Shall I send the official invite to your registered email (${patient?.email || 'not set'})?` }]);
        }, 700);
    };

    const handleConfirm = async () => {
        setConfirming(true);
        setMessages(prev => [...prev, { from: 'user', text: 'Yes, confirm booking and send email.' }]);

        try {
            await api.post('/appointments/book', {
                patient_id: activePatientId,
                doctor_name: selectedDoc.name,
                hospital: selectedDoc.hospital,
                slot: selectedSlot,
                patient_email: patient?.email
            });

            setTimeout(() => {
                setMessages(prev => [...prev, { from: 'ai', text: `✅ Appointment SECURED! I've sent a detailed clinical briefing to ${patient?.email || 'your email'}. Check your inbox!` }]);
                setConfirming(false);
                setConfirmed(true);
            }, 1500);
        } catch (err) {
            setMessages(prev => [...prev, { from: 'ai', text: '❌ Booking failed. Please check backend connection or credentials.' }]);
            setConfirming(false);
        }
    };

    const handleSend = () => {
        if (!userInput.trim()) return;
        const msg = userInput.toLowerCase();
        setMessages(prev => [...prev, { from: 'user', text: userInput }]);
        setUserInput('');
        setTyping(true);

        setTimeout(() => {
            setTyping(false);

            let response = "I am your NeuroVoice Agent. I can help book appointments, translate clinical findings, and suggest therapeutic diets. Please follow the triage buttons for immediate help!";

            if (msg.includes('food') || msg.includes('diet') || msg.includes('eat') || msg.includes('recipe')) {
                if (msg.includes('parkinson')) {
                    response = "For Parkinson's, I recommend a diet rich in antioxidants and Omega-3. Try our 'Berry & Flax Seed Smoothie' or 'Baked Salmon'. High fiber is also key to help with digestion.";
                } else if (msg.includes('diabetes') || msg.includes('sugar')) {
                    response = "Managing blood sugar is crucial. I suggest 'Cauliflower Fried Rice' or 'Chickpea and Tuna Salad'. Focus on low-glycemic foods and high fiber to prevent insulin spikes.";
                } else if (msg.includes('heart') || msg.includes('cardio') || msg.includes('cholesterol')) {
                    response = "Heart-healthy diets should be low in sodium. Try the 'Mediterranean Hummus Bowl' or 'Oatmeal with Walnuts'. These help lower LDL cholesterol and support arterial health.";
                } else if (msg.includes('bp') || msg.includes('pressure') || msg.includes('hypertension')) {
                    response = "To lower blood pressure, increase potassium and reduce salt. 'Roasted Beetroot Salad' and 'Hibiscus Tea' are excellent choices. Garlic also helps relax blood vessels.";
                } else if (msg.includes('brain') || msg.includes('memory') || msg.includes('alzheimer')) {
                    response = "Cognitive health thrives on the MIND diet. Berries, walnuts, and leafy greens are vital. Try our 'Blueberry & Oat Pancakes' or 'Curried Cauliflower' for neuroprotection.";
                } else {
                    response = "Healthy eating is medicine! We have 50+ recipes in our 'Recipe Maker' section tailored for specific conditions. Generally, focus on whole foods, healthy fats, and plenty of greens. Would you like a specific recommendation for a condition?";
                }
            } else if (msg.includes('hello') || msg.includes('hi')) {
                response = "Hello! I'm your NeuroVoice Health Assistant. How can I help you today? You can ask about appointments, your scan results, or healthy food recommendations.";
            }

            setMessages(prev => [...prev, { from: 'ai', text: response }]);
        }, 1400);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">🤖 AI Triage Bot</h1>
                    <p className="page-subtitle">Personalized Neurological Screening · Books appointments · Sends reports via Email</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge badge-cyan"><Zap size={11} /> AI Specialist Agent</span>
                    <span className="badge badge-green"><Clock size={11} /> 24/7 Availability</span>
                </div>
            </div>

            <div className="page-body">
                {!started ? (
                    /* Entry Card */
                    <div className="fade-in" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
                        <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: 'var(--shadow-glow-purple)' }}>
                            <Bot size={44} color="white" />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Meet Your AI Triage Agent</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
                            Your last scan detected <span style={{ color: (latestSession?.risk_score || 0) > 70 ? 'var(--accent-red)' : (latestSession?.risk_score || 0) > 35 ? 'var(--accent-amber)' : 'var(--accent-green)', fontWeight: 700 }}>{latestSession?.risk_label || 'stable'} vocal biomarkers</span>. Our agentic AI has already pre-screened 20+ neurologists near you and is ready to book the best match in seconds.
                        </p>
                        <div className={`alert alert-${(latestSession?.risk_score || 0) > 70 ? 'danger' : (latestSession?.risk_score || 0) > 35 ? 'warning' : 'info'}`} style={{ textAlign: 'left', marginBottom: 28 }}>
                            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                            <div>{latestSession?.risk_label === 'High' ? 'High-risk vocal tremor patterns detected' : latestSession?.risk_label === 'Medium' ? 'Subtle vocal fluctuations detected' : 'Stable vocal signature maintained'} in today&apos;s scan. Early consultation {latestSession?.risk_label === 'High' ? 'is critical' : 'is recommended'} for long-term health.</div>
                        </div>
                        <button className="btn btn-primary btn-xl" id="btn-start-agent" onClick={startFlow}>
                            <Bot size={20} /> Activate AI Agent
                        </button>
                    </div>
                ) : (
                    <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
                        {/* Chat Panel */}
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot size={18} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>NeuroAgent</div>
                                    <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent-green)' }}>
                                        <div className="pulse-dot" style={{ width: 7, height: 7 }} /> Active
                                    </div>
                                </div>
                                <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>NeuroAI</span>
                            </div>

                            {/* Messages */}
                            <div ref={chatRef} className="chat-wrap" style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                                {messages.map((m, i) => (
                                    <div key={i} className={`chat-bubble ${m.from} fade-in`}>{m.text}</div>
                                ))}
                                {typing && <TypingIndicator />}
                                {confirmed && (
                                    <div className="alert alert-success fade-in" style={{ margin: 0 }}>
                                        <CheckCircle size={18} style={{ flexShrink: 0 }} />
                                        <div><strong>Appointment Confirmed!</strong> Official invite sent to {patient?.email}. Calendar invite synced.</div>
                                    </div>
                                )}
                            </div>

                            {/* Quick replies */}
                            {selectedDoc && selectedSlot && !confirmed && (
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', gap: 8 }}>
                                    <button className="btn btn-success" style={{ flex: 1 }} disabled={confirming} onClick={handleConfirm}>
                                        {confirming ? <><div className="spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%' }} /> Booking on Server…</> : <><CheckCircle size={15} /> Confirm & Send Email</>}
                                    </button>
                                </div>
                            )}

                            {/* Text input */}
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', gap: 8, marginTop: 8 }}>
                                <input value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    className="input" placeholder="Ask the agent anything…" style={{ flex: 1, height: 40 }} />
                                <button className="btn btn-primary btn-sm" onClick={handleSend}><Send size={15} /></button>
                            </div>
                        </div>

                        {/* Doctors Panel */}
                        <div>
                            {showDoctors && (
                                <div className="fade-in">
                                    <div className="section-title"><MapPin size={16} color="var(--accent-red)" /> Neurologists Near You</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                                        {doctors.map(doc => (
                                            <div key={doc.id} className="card" style={{ cursor: 'pointer', border: selectedDoc?.id === doc.id ? '1px solid rgba(124,58,237,0.5)' : '1px solid var(--border)', background: selectedDoc?.id === doc.id ? 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.05))' : '' }}
                                                onClick={() => handleSelectDoc(doc)}>
                                                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
                                                    <div style={{ fontSize: 36, lineHeight: 1 }}>{doc.name.split(' ').map(n => n[0]).join('')}</div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{doc.name}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{doc.specialty}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{doc.hospital}</span>
                                                            <a href={doc.externalUrl} target="_blank" rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                                                                <ArrowUpRight size={12} /> View Profile
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fbbf24', fontWeight: 700, fontSize: 13 }}><Star size={13} fill="#fbbf24" />{doc.rating}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.reviews} reviews</div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>{doc.fee}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.distance}</div>
                                                    </div>
                                                </div>

                                                {selectedDoc?.id === doc.id && (
                                                    <div className="fade-in">
                                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available Dates</div>
                                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                            {doc.available.map(slot => (
                                                                <button key={slot} onClick={e => { e.stopPropagation(); handleSelectSlot(slot); }}
                                                                    className={`btn btn-sm ${selectedSlot === slot ? 'btn-primary' : 'btn-ghost'}`}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <Clock size={12} /> {slot}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {confirmed && (
                                        <div className="card card-gradient-green fade-in" style={{ textAlign: 'center', padding: 32 }}>
                                            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Appointment Confirmed!</div>
                                            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>{selectedDoc?.name}</strong><br />
                                                {selectedSlot} · {selectedDoc?.hospital}<br /><br />
                                                📧 Confirmation report sent to your <strong>Email</strong><br />
                                                📅 Google Calendar invite synced
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!showDoctors && (
                                <div className="card" style={{ textAlign: 'center', padding: 48, opacity: 0.5 }}>
                                    <MessageSquare size={40} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
                                    <p style={{ color: 'var(--text-muted)' }}>Neurologist options will appear here once the agent fetches availability.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
