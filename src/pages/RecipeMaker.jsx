// ── Simple Markdown-ish Formatter ──────────────────────────────────────────
import { useState } from 'react';
import { Search, Utensils, Heart, Activity, Brain, Shield, ChevronRight, Info, Filter, MessageSquare, Send, Bot, X, Zap } from 'lucide-react';
import { recipes } from '../data/recipes';

function FormatBotText({ text }) {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
        <span key={i}>
            {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} style={{ color: 'var(--accent-cyan)' }}>{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
            {i < text.split('\n').length - 1 && <br />}
        </span>
    ));
}

export default function RecipeMaker() {
    const [search, setSearch] = useState('');
    const [selectedDisease, setSelectedDisease] = useState('All');
    const [isBotOpen, setIsBotOpen] = useState(false);
    const [messages, setMessages] = useState([
        { from: 'ai', text: "👋 Hello! I'm your Precision Nutrition AI. I can suggest therapeutic meals, explain health benefits, or help you find recipes in our database. How can I assist you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const diseases = ['All', ...new Set(recipes.map(r => r.disease))];

    const filteredRecipes = recipes.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.ingredients.some(i => i.toLowerCase().includes(search.toLowerCase()));
        const matchesDisease = selectedDisease === 'All' || r.disease === selectedDisease;
        return matchesSearch && matchesDisease;
    });

    const handleSend = () => {
        if (!input.trim()) return;
        const msg = input.toLowerCase();
        setMessages(prev => [...prev, { from: 'user', text: input }]);
        setInput('');
        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);

            // ── Dynamic Nutrition Engine ───────────────────────────────────────
            const dishName = input.replace(/recipie|recipe|how to make|analyze/gi, '').trim() || "that dish";
            const capitalizedDish = dishName.charAt(0).toUpperCase() + dishName.slice(1);

            // Analysis Components
            let ingredients = [];
            let steps = [];
            let pros = [];
            let cons = [];
            let neuroTip = "";

            // 1. Determine Core Type & Ingredients
            if (msg.includes('pork') || msg.includes('beef') || msg.includes('bacon') || msg.includes('meat') || msg.includes('steak')) {
                ingredients = [`Fresh ${capitalizedDish}`, "Pepper", "Sea Salt", "Garlic", "Thyme"];
                steps = [`1. Season the ${dishName} with salt and pepper.`, `2. Sauté in a heavy pan until ${msg.includes('beef') ? 'medium-rare' : 'fully cooked'}.`, "3. Rest for 5 minutes before serving."];
                pros = ["High B12 for nerve coating.", "Complete protein for muscle density."];
                cons = ["Contains Neu5Gc (Chronic Inflammatory marker).", "Saturated fats can increase arterial stiffness.", "High protein may block Levodopa absorption if timed poorly."];
                neuroTip = "Switch to Lean Chicken or Salmon 3x a week to lower systemic inflammation.";
            } else if (msg.includes('chicken') || msg.includes('egg') || msg.includes('protein')) {
                ingredients = [`${capitalizedDish}`, "Olive Oil", "Herbs", "Garlic"];
                steps = [`1. Lightly marinate ${dishName}.`, "2. Grill or bake until tender.", "3. Serve with green leavy vegetables."];
                pros = ["Clean protein without Neu5Gc.", "Eggs provide Choline for memory/focus."];
                cons = ["High salt if processed.", "Excessive portions can cause digestive fatigue."];
                neuroTip = "Steam instead of frying to preserve amino acid integrity.";
            } else if (msg.includes('fry') || msg.includes('oil') || msg.includes('chips') || msg.includes('samosa') || msg.includes('ball') || msg.includes('pizza') || msg.includes('burger')) {
                ingredients = [`${capitalizedDish} base`, "Refined Oil", "Sodium", "Batter"];
                steps = [`1. Prepare the ${dishName} base.`, "2. Deep fry or bake with oils.", "3. Season heavily with salt."];
                pros = ["High caloric density for tremor-induced weight loss.", "Sodium helps if experiencing hypotension."];
                cons = ["Trans-fats trigger Neuroinflammation.", "High Glycemic Load causes insulin spikes (Brain Fog).", "Acrylamides from frying stress and age neurons."];
                neuroTip = "Bake with Air-fryer and use Pink Himalayan salt to reduce sodium spikes.";
            } else if (msg.includes('salad') || msg.includes('veg') || msg.includes('fruit') || msg.includes('berry') || msg.includes('smoothie')) {
                ingredients = [`Fresh ${capitalizedDish}`, "Walnuts", "Lemon", "Olive Oil"];
                steps = [`1. Wash and chop your ${dishName}.`, "2. Toss with a light vinaigrette.", "3. Top with nuts for healthy fats."];
                pros = ["Rich in antioxidants (Flavonoids).", "Fiber supports Gut-Brain Axis.", "Lowers blood pressure naturally."];
                cons = ["Low protein (needs pairing).", "Possible oxalates if solely based on spinach."];
                neuroTip = "Add Flax seeds to maximize the anti-inflammatory effect.";
            } else {
                // Generative Fallback
                ingredients = [capitalizedDish, "Aromatic Spices", "Healthy Fats (Olive Oil)", "Green garnish"];
                steps = [`1. Prepare your ${dishName} core.`, "2. Season carefully to avoid high sodium.", "3. Cook slowly to preserve nutrients."];
                pros = ["Provides essential micronutrients.", "Energy for neurological function."];
                cons = ["Potential for inflammation if processed.", "Salt/Sugar levels must be monitored."];
                neuroTip = "Always add a side of leafy greens to any dish to buffer sugar spikes.";
            }

            const response = `Analysis of **${capitalizedDish}**:

👨‍🍳 **Generative Recipe:**
${steps.join('\n')}

✅ **The Good:**
${pros.map(p => `• ${p}`).join('\n')}

❌ **The Risks:**
${cons.map(c => `• ${c}`).join('\n')}

💡 **Clinical Tip:** ${neuroTip}

Would you like me to analyze another dish or find a similar recipe from our database?`;

            setMessages(prev => [...prev, { from: 'ai', text: response }]);
        }, 1200);
    };
    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🥗 Therapeutic Recipe Maker</h1>
                    <p className="page-subtitle">50+ Precision Nutrition Recipes tailored for chronic diseases and recovery.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge badge-green"><Shield size={11} /> Certified Healthy</span>
                    <span className="badge badge-purple"><Activity size={11} /> Disease-Specific</span>
                </div>
            </div>

            <div className="page-body">
                {/* Search & Filter Bar */}
                <div className="card" style={{ marginBottom: 24, padding: 16 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, position: 'relative', minWidth: 280 }}>
                            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Search by ingredient or recipe name..."
                                style={{ paddingLeft: 40, width: '100%' }}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Filter size={18} color="var(--text-muted)" />
                            <div style={{ display: 'flex', gap: 6 }}>
                                {diseases.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSelectedDisease(d)}
                                        className={`btn btn-sm ${selectedDisease === d ? 'btn-primary' : 'btn-ghost'}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recipe Grid */}
                <div className="grid-3" style={{ gap: 20 }}>
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id} className="card recipe-card hover-lift" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <span className={`badge ${recipe.disease === "Parkinson's" ? 'badge-purple' :
                                        recipe.disease === 'Diabetes' ? 'badge-amber' :
                                            recipe.disease === 'Heart Disease' ? 'badge-red' :
                                                recipe.disease === 'Hypertension' ? 'badge-cyan' : 'badge-green'
                                        }`}>
                                        {recipe.disease}
                                    </span>
                                    <Utensils size={18} color="var(--text-muted)" />
                                </div>
                                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{recipe.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent-purple)', fontWeight: 600, marginBottom: 12 }}>
                                    <Activity size={14} /> {recipe.category}
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                                    {recipe.benefit}
                                </p>
                            </div>

                            <div style={{ marginTop: 'auto' }}>
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Info size={12} /> Key Ingredients
                                    </div>
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                        {recipe.ingredients.map((ing, i) => (
                                            <span key={i} style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>{ing}</span>
                                        ))}
                                    </div>
                                </div>

                                <details style={{ cursor: 'pointer' }}>
                                    <summary style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Show Instructions <ChevronRight size={14} />
                                    </summary>
                                    <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--brand-1)' }}>
                                        {recipe.instructions}
                                    </p>
                                </details>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredRecipes.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <Utensils size={48} color="var(--text-muted)" style={{ marginBottom: 16, opacity: 0.3 }} />
                        <h3 style={{ color: 'var(--text-secondary)' }}>No recipes found matching your filters.</h3>
                    </div>
                )}
            </div>

            {/* AI Nutrition Bot Floating Button */}
            <button
                onClick={() => setIsBotOpen(true)}
                className="bot-fab slide-up"
                style={{
                    position: 'fixed',
                    bottom: 30,
                    right: 30,
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
                    border: 'none',
                    cursor: 'pointer',
                    zIndex: 1000,
                    transition: 'all 0.3s ease'
                }}
            >
                <Bot size={28} />
                <span className="bot-ping" />
            </button>

            {/* Bot Modal/Panel */}
            {isBotOpen && (
                <div className="bot-panel fade-in">
                    <div className="bot-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="bot-avatar">
                                <Bot size={18} color="white" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 14 }}>Nutrition Support AI</div>
                                <div style={{ fontSize: 11, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div className="pulse-dot" style={{ width: 6, height: 6 }} /> Precision Dietetics Active
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsBotOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="bot-messages">
                        {messages.map((m, i) => (
                            <div key={i} className={`chat-bubble ${m.from}`}>
                                <FormatBotText text={m.text} />
                            </div>
                        ))}
                        {isTyping && (
                            <div className="chat-bubble ai" style={{ display: 'flex', gap: 4 }}>
                                <div className="typing-dot" />
                                <div className="typing-dot" style={{ animationDelay: '0.2s' }} />
                                <div className="typing-dot" style={{ animationDelay: '0.4s' }} />
                            </div>
                        )}
                    </div>

                    <div className="bot-input-area">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about diet, health, or recipes..."
                            className="bot-input"
                        />
                        <button onClick={handleSend} className="bot-send-btn">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .recipe-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .recipe-card:hover {
                    border-color: var(--brand-1);
                }
                details summary::-webkit-details-marker {
                    display: none;
                }
                details[open] summary svg {
                    transform: rotate(90deg);
                }
                .bot-fab:hover {
                    transform: scale(1.1) rotate(5deg);
                }
                .bot-ping {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 14px;
                    height: 14px;
                    background: var(--accent-green);
                    border: 2px solid white;
                    border-radius: 50%;
                }
                .bot-panel {
                    position: fixed;
                    bottom: 110px;
                    right: 30px;
                    width: 380px;
                    height: 500px;
                    background: rgba(10, 15, 30, 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                    z-index: 1001;
                    overflow: hidden;
                }
                @media (max-width: 500px) {
                    .bot-panel {
                        width: calc(100% - 40px);
                        right: 20px;
                        bottom: 100px;
                        height: 450px;
                    }
                }
                .bot-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.03);
                }
                .bot-avatar {
                    width: 34px;
                    height: 34px;
                    border-radius: 10px;
                    background: var(--brand-1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .bot-messages {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .bot-input-area {
                    padding: 16px;
                    border-top: 1px solid var(--border);
                    display: flex;
                    gap: 10px;
                    background: rgba(255, 255, 255, 0.02);
                }
                .bot-input {
                    flex: 1;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    padding: 10px 14px;
                    color: white;
                    font-size: 13px;
                    outline: none;
                }
                .bot-input:focus {
                    border-color: var(--brand-1);
                }
                .bot-send-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: var(--brand-1);
                    color: white;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }
                .typing-dot {
                    width: 6px;
                    height: 6px;
                    background: var(--accent-cyan);
                    border-radius: 50%;
                    animation: typingPulse 1s infinite alternate;
                }
                @keyframes typingPulse {
                    from { opacity: 0.3; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1.1); }
                }
            `}} />
        </div>
    );
}
