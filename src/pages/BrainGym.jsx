// src/pages/BrainGym.jsx – Neuro-Behavioral Persona Assessment
import { useState, useEffect } from 'react';
import { Brain, Sparkles, User, Shield, Zap, Target, Heart, Eye, ChevronRight, Trophy, RotateCcw, MessageSquare, Compass, Activity, LayoutGrid } from 'lucide-react';

const SCENARIOS = [
    {
        id: 1,
        question: "You find a lost wallet with a significant amount of cash and a high-status business card inside. What is your immediate impulse?",
        options: [
            { text: "Contact the owner immediately to return everything.", trait: "Integrity", weight: 3 },
            { text: "Take a small 'finder's fee' and then return it.", trait: "Pragmatism", weight: 1 },
            { text: "Leave it there to avoid any potential legal trouble.", trait: "Caution", weight: 2 },
            { text: "Keep the cash but post the wallet in a lost & found.", trait: "Opportunism", weight: -1 }
        ]
    },
    {
        id: 2,
        question: "A colleague is being unfairly blamed for a mistake you actually had a small part in. The boss is furious.",
        options: [
            { text: "Step forward immediately and share the responsibility.", trait: "Courage", weight: 3 },
            { text: "Wait for the meeting to end and talk to the colleague privately.", trait: "Diplomacy", weight: 1 },
            { text: "Stay silent; the mistake is minor and will blow over.", trait: "Preservation", weight: 0 },
            { text: "Subtly shift the blame to a process error instead of a person.", trait: "Strategic", weight: 2 }
        ]
    },
    {
        id: 3,
        question: "You are in a high-stakes negotiation. The other party makes a clear logical error that favors you significantly.",
        options: [
            { text: "Correct them immediately to ensure a fair long-term deal.", trait: "Ethics", weight: 3 },
            { text: "Ignore the error and close the deal as quickly as possible.", trait: "Vigilance", weight: -1 },
            { text: "Use the error as leverage to get even better terms elsewhere.", trait: "Ambition", weight: 2 },
            { text: "Ask for a break to decide how to proceed fairly.", trait: "Analytical", weight: 1 }
        ]
    },
    {
        id: 4,
        question: "An AI system offers you a way to automate your job perfectly, but it requires bypassing company security protocols.",
        options: [
            { text: "Refuse and report the vulnerability.", trait: "Duty", weight: 3 },
            { text: "Use it secretly to become the top performer.", trait: "Innovation", weight: -1 },
            { text: "Study the AI to understand how to fix the protocol legally.", trait: "Logic", weight: 2 },
            { text: "Ignore the AI; the risk of getting caught is too high.", trait: "Safety", weight: 1 }
        ]
    },
    {
        id: 5,
        question: "You see someone being bullied in a public space. They are clearly distressed.",
        options: [
            { text: "Intervene directly and firmly stop the bully.", trait: "Justice", weight: 3 },
            { text: "Call for security or authorities immediately.", trait: "Systematic", weight: 2 },
            { text: "Record the incident as evidence for later.", trait: "Observer", weight: 1 },
            { text: "Move away to ensure your own safety first.", trait: "Introvert", weight: 0 }
        ]
    },
    {
        id: 6,
        question: "You have one month of free time and unlimited resources. What project do you start?",
        options: [
            { text: "Building a charitable foundation for neuro-health.", trait: "Altruism", weight: 3 },
            { text: "Developing a complex investment algorithm.", trait: "Intelligence", weight: 2 },
            { text: "Traveling the world to document rare cultures.", trait: "Curiosity", weight: 2 },
            { text: "Refining your personal skills in isolation.", trait: "Autonomy", weight: 1 }
        ]
    },
    {
        id: 7,
        question: "A close friend shares a secret that could destroy another person's career if revealed.",
        options: [
            { text: "Keep the secret strictly, no matter what.", trait: "Loyalty", weight: 3 },
            { text: "Convince the friend to come clean themselves.", trait: "Harmony", weight: 2 },
            { text: "Anonymously tip off the person at risk.", trait: "Protection", weight: 1 },
            { text: "Distance yourself from the friend and the secret.", trait: "Separation", weight: 0 }
        ]
    },
    {
        id: 8,
        question: "You are leading a team during a crisis. Resources are 50% depleted and moral is low.",
        options: [
            { text: "Take the hardest tasks yourself to inspire the team.", trait: "Charisma", weight: 3 },
            { text: "Strictly ration resources and enforce new rules.", trait: "Stoic", weight: 2 },
            { text: "Host an open forum to let everyone vent and share ideas.", trait: "Empathy", weight: 2 },
            { text: "Calculate the exact moment to pivot the mission strategy.", trait: "Precision", weight: 1 }
        ]
    },
    {
        id: 9,
        question: "You discover your mentor has been falsifying data for years.",
        options: [
            { text: "Expose them immediately to preserve scientific truth.", trait: "Honesty", weight: 3 },
            { text: "Confront them and demand they retire quietly.", trait: "Respect", weight: 1 },
            { text: "Re-verify all their work yourself without telling them.", trait: "Thorough", weight: 2 },
            { text: "Protect their legacy; the data doesn't change lives.", trait: "Sentiment", weight: -1 }
        ]
    },
    {
        id: 10,
        question: "A stranger offers you a capsule that guarantees 10 extra years of peak health but erases your last 2 years of memory.",
        options: [
            { text: "Decline; my memories are my identity.", trait: "Depth", weight: 3 },
            { text: "Accept; the future health outweighs the past.", trait: "Utility", weight: 2 },
            { text: "Ask for clinical data and peer-reviews first.", trait: "Skeptic", weight: 3 },
            { text: "Negotiate for a shorter health span but less memory loss.", trait: "Creative", weight: 1 }
        ]
    },
    {
        id: 11,
        question: "The power goes out during a major storm. You are alone.",
        options: [
            { text: "Systematically check all emergency kits and seals.", trait: "Preparedness", weight: 2 },
            { text: "Meditate and enjoy the forced digital detox.", trait: "Peace", weight: 3 },
            { text: "Try to fix the fuse box despite the rain.", trait: "Action", weight: 1 },
            { text: "Call neighbors to ensure they are okay too.", trait: "Social", weight: 2 }
        ]
    },
    {
        id: 12,
        question: "You win a prestigious award. Your speech is 3 minutes long.",
        options: [
            { text: "Spend the whole time thanking every single helper.", trait: "Gratitude", weight: 3 },
            { text: "Use the platform to advocate for a global cause.", trait: "Vision", weight: 3 },
            { text: "Keep it short, humble, and get off stage fast.", trait: "Modesty", weight: 1 },
            { text: "Tell a self-deprecating joke to make people laugh.", trait: "Humor", weight: 2 }
        ]
    },
    {
        id: 13,
        question: "You are given a button that deletes one 'bad' thing from the world, but you don't choose which one.",
        options: [
            { text: "Press it; any bad thing gone is a win.", trait: "Optimism", weight: 1 },
            { text: "Refuse; the 'bad' might be something necessary for growth.", trait: "Wisdom", weight: 3 },
            { text: "Try to hack the machine to see the list first.", trait: "Rebellion", weight: -1 },
            { text: "Consult a philosopher before deciding.", trait: "Deliberation", weight: 2 }
        ]
    },
    {
        id: 14,
        question: "Traffic is at a standstill. You are 20 minutes late for a life-changing interview.",
        options: [
            { text: "Call ahead, explain calmly, and keep driving safely.", trait: "Composure", weight: 3 },
            { text: "Abandon the car and run the remaining distance.", trait: "Determination", weight: 3 },
            { text: "Accept the fate and listen to a podcast to relax.", trait: "Resignation", weight: 1 },
            { text: "Take a risky illegal U-turn to find a shortcut.", trait: "Risk", weight: -1 }
        ]
    },
    {
        id: 15,
        question: "You find a door that leads to your own future, exactly one year from now.",
        options: [
            { text: "Enter immediately to gain an advantage.", trait: "Eagerness", weight: -1 },
            { text: "Lock the door and throw away the key.", trait: "Purity", weight: 3 },
            { text: "Set up a camera to peek without entering.", trait: "Cunning", weight: 2 },
            { text: "Wait exactly one year to enter it naturally.", trait: "Patience", weight: 3 }
        ]
    }
];

const PERSONAS = [
    { id: 'titan', name: "The Unshakable Titan", icon: Shield, color: "var(--accent-purple)", desc: "A person of iron willpower and absolute moral clarity. You lead by example and never compromise on your core ethics, even when the world is crumbling." },
    { id: 'phantom', name: "The Strategic Phantom", icon: Zap, color: "var(--accent-cyan)", desc: "Calculated, precise, and quiet. You move through scenarios like a ghost, choosing the most efficient path with surgical accuracy." },
    { id: 'sage', name: "The Compassionate Sage", icon: Heart, color: "var(--accent-pink)", desc: "Your highest value is the well-being of others. You possess deep emotional intelligence and act as a healer in every social friction." },
    { id: 'architect', name: "The Logical Architect", icon: LayoutGrid, color: "var(--accent-green)", desc: "You see the world in systems and patterns. You solve problems with cold, hard logic and value structural integrity over emotional impulse." },
    { id: 'maverick', name: "The Bold Maverick", icon: Activity, color: "var(--accent-amber)", desc: "Rules are suggestions to you. You value action and personal freedom above all else, often taking high risks for high neurological rewards." },
    { id: 'observer', name: "The Silent Watcher", icon: Eye, color: "var(--text-muted)", desc: "You prefer to analyze from the periphery. You are patient, deeply thorough, and possess a level of situational awareness that few can match." },
    { id: 'guardian', name: "The Sovereign Guardian", icon: Compass, color: "var(--brand-1)", desc: "A protector of the status quo and of those who cannot protect themselves. You are the shield between order and chaos." }
];

export default function BrainGym({ activePatientId, patients }) {
    const [step, setStep] = useState('intro'); // intro | testing | result
    const [qIdx, setQIdx] = useState(0);
    const [scores, setScores] = useState({ moral: 0, logic: 0, courage: 0, empathy: 0 });
    const [persona, setPersona] = useState(null);

    const activePatient = patients.find(p => p.id === activePatientId);

    const handleAnswer = (option) => {
        const newScores = { ...scores };
        // Simple heuristic mapping for persona logic
        if (option.weight > 2) newScores.moral += option.weight;
        if (option.trait === 'Logic' || option.trait === 'Analytical') newScores.logic += 3;
        if (option.trait === 'Courage' || option.trait === 'Action') newScores.courage += 3;
        if (option.trait === 'Empathy' || option.trait === 'Altruism') newScores.empathy += 3;

        setScores(newScores);

        if (qIdx < SCENARIOS.length - 1) {
            setQIdx(qIdx + 1);
        } else {
            calculatePersona(newScores);
        }
    };

    const calculatePersona = (finalScores) => {
        // Simple logic to map the highest trait to a persona
        let p = PERSONAS[0];
        if (finalScores.moral > 20) p = PERSONAS[0]; // Titan
        else if (finalScores.logic > 10) p = PERSONAS[3]; // Architect
        else if (finalScores.empathy > 10) p = PERSONAS[2]; // Sage
        else if (finalScores.courage > 10) p = PERSONAS[4]; // Maverick
        else if (finalScores.moral > 10 && finalScores.logic > 5) p = PERSONAS[6]; // Guardian
        else if (finalScores.logic > 5 && finalScores.empathy > 5) p = PERSONAS[5]; // Observer
        else p = PERSONAS[1]; // Phantom (Neutral/Strategic)

        setPersona(p);
        setStep('result');
    };

    const reset = () => {
        setStep('intro');
        setQIdx(0);
        setScores({ moral: 0, logic: 0, courage: 0, empathy: 0 });
        setPersona(null);
    };

    return (
        <div style={{ paddingBottom: 60 }} className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🧠 Neuro-Behavioral Persona</h1>
                    <p className="page-subtitle">A deep scenario-based assessment for <strong>{activePatient?.name || 'User'}</strong>.</p>
                </div>
                {step !== 'intro' && (
                    <button className="btn btn-secondary" onClick={reset}><RotateCcw size={16} /> Restart Test</button>
                )}
            </div>

            <div className="page-body">
                {step === 'intro' && (
                    <div className="card card-glass fade-in" style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 800, margin: '0 auto' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Brain size={40} color="var(--brand-1)" />
                        </div>
                        <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 16 }}>The Persona Calibration</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
                            Forget logic puzzles. This test analyzes your <strong>subconscious behavioral patterns</strong> through 15 complex ethical and strategic scenarios.
                            Your choices will reveal which of the <strong>7 Core Neuro-Personas</strong> defines your current clinical profile.
                        </p>
                        <button className="btn btn-primary btn-xl" style={{ minWidth: 200 }} onClick={() => setStep('testing')}>
                            Begin Analysis <ChevronRight size={18} />
                        </button>
                        <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
                            Time investment: 4 Minutes · Depth: Deep Clinical
                        </div>
                    </div>
                )}

                {step === 'testing' && (
                    <div className="card fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
                        <div style={{ marginBottom: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-1)', textTransform: 'uppercase' }}>Scenario {qIdx + 1} of 15</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Math.round(((qIdx + 1) / 15) * 100)}% Evaluated</span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                <div style={{ height: '100%', background: 'var(--brand-1)', width: `${((qIdx + 1) / 15) * 100}%`, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                            </div>
                        </div>

                        <h3 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.4, marginBottom: 32, minHeight: 68 }}>{SCENARIOS[qIdx].question}</h3>

                        <div style={{ display: 'grid', gap: 12 }}>
                            {SCENARIOS[qIdx].options.map((opt, i) => (
                                <button key={i} className="btn btn-secondary" style={{
                                    padding: '18px 24px', textAlign: 'left', justifyContent: 'flex-start', fontSize: 15, fontWeight: 500,
                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)'
                                }} onClick={() => handleAnswer(opt)}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</div>
                                    {opt.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'result' && (
                    <div className="fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
                        <div className="card" style={{ textAlign: 'center', padding: '60px 40px', background: 'linear-gradient(180deg, rgba(124, 58, 237, 0.05) 0%, rgba(5, 8, 18, 0) 100%)', border: `1px solid ${persona.color}44` }}>
                            <div style={{ width: 100, height: 100, borderRadius: 28, background: `${persona.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: `0 0 40px ${persona.color}22` }}>
                                <persona.icon size={48} color={persona.color} />
                            </div>
                            <div style={{ fontSize: 12, color: persona.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 }}>Analysis Complete</div>
                            <h2 style={{ fontSize: 42, fontWeight: 900, marginBottom: 16 }}>{persona.name}</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 17, lineHeight: 1.8, maxWidth: 650, margin: '0 auto 32px' }}>
                                {persona.desc}
                            </p>

                            <div className="stats-grid" style={{ marginBottom: 40 }}>
                                <div className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>COGNITIVE XP</div>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-amber)' }}>+250 XP</div>
                                </div>
                                <div className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>MORAL TIER</div>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-green)' }}>Platinum</div>
                                </div>
                                <div className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>MATCH RATIO</div>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-cyan)' }}>98.2%</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                                <button className="btn btn-primary btn-xl" onClick={reset}>Retake Calibration</button>
                                <button className="btn btn-secondary btn-xl">Download Profile</button>
                            </div>
                        </div>

                        <div className="card" style={{ marginTop: 24, background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                <MessageSquare size={32} color="var(--brand-1)" />
                                <div>
                                    <h4 style={{ fontSize: 16, fontWeight: 800 }}>Clinical Interpretation</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                                        This persona analysis maps to your **Executive Frontal Lobe** function. Your consistently strategic choices indicate high neural connectivity in regions responsible for complex planning and ethical deliberation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
