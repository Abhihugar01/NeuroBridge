// src/components/Sidebar.jsx
import { useState } from 'react';
import {
    Brain, Mic, Calendar, Trophy, Activity, Utensils, Hand,
    ChevronRight, Settings, HelpCircle, Zap, Users
} from 'lucide-react';

const CLINICAL_NAV = [
    { id: 'dashboard', icon: Activity, label: 'Dashboard', badge: null },
    { id: 'patients', icon: Users, label: 'Patients', badge: null },
    { id: 'scan', icon: Mic, label: 'Voice Scan', badge: 'LIVE' },
    { id: 'motor', icon: Activity, label: 'Motor Test', badge: 'NEW' },
    { id: 'imaging', icon: Brain, label: 'Imaging AI Scan', badge: 'NEW' },
];

const ACCESSIBILITY_NAV = [
    { id: 'signbridge', icon: Hand, label: 'SignBridge', badge: 'PRO' },
    { id: 'appointment', icon: Calendar, label: 'Interpreter Bot', badge: null },
];

const RESOURCE_NAV = [
    { id: 'recipes', icon: Utensils, label: 'Recipe Maker', badge: '50+' },
    { id: 'community', icon: Users, label: 'Community Blog', badge: '5+' },
    { id: 'braingym', icon: Trophy, label: 'Brain Gym', badge: 'NEW' },
];

export default function Sidebar({ activePage, onNavigate, isOpen, onClose, patients = [], activePatientId }) {
    const activePatient = patients.find(p => p.id === activePatientId);

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                {/* Close btn mobile */}
                <button className="sidebar-mobile-close" onClick={onClose}>
                    <ChevronRight style={{ transform: 'rotate(180deg)' }} />
                </button>

                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="logo-icon">
                        <Brain size={22} color="white" />
                    </div>
                    <div>
                        <div className="logo-text">NeuroVoice</div>
                        <div className="logo-sub">AI Screening · 2026</div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    <div className="nav-section-label">Neurology Suite</div>
                    {CLINICAL_NAV.map(item => (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            className={`nav-item${activePage === item.id ? ' active' : ''}`}
                            onClick={() => onNavigate(item.id)}
                        >
                            <item.icon size={18} className="nav-icon" />
                            <span>{item.label}</span>
                            {item.badge && <span className="nav-badge">{item.badge}</span>}
                        </button>
                    ))}

                    <div className="nav-section-label" style={{ marginTop: 12 }}>Accessibility Suite</div>
                    {ACCESSIBILITY_NAV.map(item => (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            className={`nav-item${activePage === item.id ? ' active' : ''}`}
                            onClick={() => onNavigate(item.id)}
                            style={{ 
                                borderColor: activePage === item.id ? 'var(--accent-cyan)' : 'transparent',
                                background: activePage === item.id ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(124, 58, 237, 0.1))' : 'transparent'
                            }}
                        >
                            <item.icon size={18} className="nav-icon" style={{ color: activePage === item.id ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
                            <span>{item.label}</span>
                            {item.badge && <span className="nav-badge" style={{ background: 'linear-gradient(135deg, var(--brand-2), var(--brand-1))' }}>{item.badge}</span>}
                        </button>
                    ))}

                    <div className="nav-section-label" style={{ marginTop: 12 }}>Resources & Community</div>
                    {RESOURCE_NAV.map(item => (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            className={`nav-item${activePage === item.id ? ' active' : ''}`}
                            onClick={() => onNavigate(item.id)}
                        >
                            <item.icon size={18} className="nav-icon" />
                            <span>{item.label}</span>
                            {item.badge && <span className="nav-badge" style={{ opacity: 0.8 }}>{item.badge}</span>}
                        </button>
                    ))}

                    <div className="nav-section-label" style={{ marginTop: 8 }}>Support</div>
                    <button className="nav-item" onClick={() => { }}>
                        <HelpCircle size={18} className="nav-icon" />
                        <span>Help & FAQ</span>
                    </button>
                    <button className="nav-item" onClick={() => { }}>
                        <Settings size={18} className="nav-icon" />
                        <span>Settings</span>
                    </button>
                </nav>

                {/* Footer user card */}
                <div className="sidebar-footer">
                    <div className="user-card" onClick={() => onNavigate('patients')} style={{ cursor: 'pointer' }}>
                        <div className="user-avatar" style={{
                            background: activePatient ? 'linear-gradient(135deg, var(--brand-1), var(--accent-pink))' : 'var(--bg-secondary)',
                            color: activePatient ? 'white' : 'var(--text-muted)'
                        }}>
                            {activePatient ? getInitials(activePatient.name) : '??'}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="user-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {activePatient ? activePatient.name : 'No Profile Selected'}
                            </div>
                            <div className="user-role">
                                {activePatient ? `Patient · Age ${activePatient.age}` : 'Tap to select patient'}
                            </div>
                        </div>
                        <ChevronRight size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(124,58,237,0.1)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.2)' }}>
                        <Zap size={13} color="var(--accent-purple)" />
                        <span style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 600 }}>AI4Bharat · BharatGen · Praat</span>
                    </div>
                </div>
            </aside>
        </>
    );
}
