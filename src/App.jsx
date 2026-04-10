// src/App.jsx
import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import VoiceScan from './pages/VoiceScan';
import MotorTest from './pages/MotorTest';
import RecipeMaker from './pages/RecipeMaker';
import AppointmentBot from './pages/AppointmentBot';
import Community from './pages/Community';
import BrainGym from './pages/BrainGym';
import Patients from './pages/Patients';
import ImagingScan from './pages/ImagingScan';
import SignBridge from './pages/SignBridge';
import { api } from './api/client';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState(null);
  const [vocalResult, setVocalResult] = useState(null);
  const [motorResult, setMotorResult] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load patients on mount & keep fresh
  const refreshPatients = async () => {
    try {
      const list = await api.listPatients();
      setPatients(list);
      if (!activePatientId && list.length > 0) {
        setActivePatientId(list[0].id);
      }
    } catch {
      // Backend not running yet — silent fail, pages show their own errors
    }
  };

  useEffect(() => {
    refreshPatients();
  }, [activePage]);   // refresh whenever page changes

  const navigate = (page) => {
    setActivePage(page);
    setIsMobileMenuOpen(false);
  };

  const renderPage = () => {
    const shared = {
      onNavigate: navigate,
      patients,
      activePatientId,
      setActivePatientId,
      vocalResult,
      setVocalResult,
      motorResult,
      setMotorResult
    };
    switch (activePage) {
      case 'dashboard': return <Dashboard    {...shared} activePage={activePage} />;
      case 'patients': return <Patients     {...shared} setActivePatientId={(id) => { setActivePatientId(id); }} />;
      case 'scan': return <VoiceScan    {...shared} />;
      case 'motor': return <MotorTest    {...shared} />;
      case 'recipes': return <RecipeMaker    {...shared} />;
      case 'appointment': return <AppointmentBot {...shared} />;
      case 'community': return <Community {...shared} />;
      case 'braingym': return <BrainGym {...shared} />;
      case 'imaging': return <ImagingScan {...shared} />;
      case 'signbridge': return <SignBridge {...shared} />;
      default: return <Dashboard    {...shared} />;
    }
  };

  return (
    <>
      <div className="bg-animated">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>
      <div className="app-layout">
        {/* Mobile Nav Button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          <Activity size={20} color="white" />
        </button>

        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          patients={patients}
          activePatientId={activePatientId}
        />
        <main className={`main-content ${isMobileMenuOpen ? 'menu-open' : ''}`}>{renderPage()}</main>
      </div>
    </>
  );
}
