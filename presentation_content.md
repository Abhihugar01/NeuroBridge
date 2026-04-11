# NeuroVoice AI — Presentation Content Data

This document contains structured content for your PPT slides based on the project codebase.

## Slide 1: Title Slide
- **Title**: NeuroVoice AI & SignBridge
- **Subtitle**: A Multimodal AI Ecosystem for Neurological Screening and Assisted Communication
- **Theme**: Advanced Clinical AI / BharatGen AI4Bharat Hackathon 2026

## Slide 2: The Healthcare Crisis
- **Problem**: 1 in 100 people over 60 live with Parkinson's; diagnosis is often 5-10 years late.
- **Key Challenges**:
    - Expensive and rare MRI/CT scans.
    - Subjective motor tests prone to human error.
    - Massive shortage of neurologists in rural sectors.
- **Communication Gap**: Patients with advanced neuro-degeneration often lose verbal clarity (Dysarthria).

## Slide 3: Our Vision: The Multimodal Screening Gateway
- **Core Value**: Transforming any camera/microphone-enabled device into a clinical screening tool.
- **Three Diagnostic Pillars**:
    1. **Vocal Biomarkers**: Detecting micro-instabilities in phonation.
    2. **Kinematic Motor Analysis**: Real-time tracking of hand tremors.
    3. **Imaging AI**: Computer vision analysis of MRI/CT scans.

## Slide 4: Vocal Biomarkers (Acoustic Intelligence)
- **Technology**: Uses **Parselmouth/Praat** for MDVP (Multidimensional Voice Program) extraction.
- **Key Metrics Analyzed**:
    - **Jitter**: Frequency stability (detects early laryngeal tremors).
    - **Shimmer**: Amplitude stability (detects vocal leakage).
    - **HNR**: Harmonics-to-Noise Ratio (measures clarity/hoarseness).
    - **PPE**: Pitch Period Entropy (mathematical marker for chaotic signal).
- **Clinical Alignment**: Mapped to **H&Y (Hoehn & Yahr)** staging.

## Slide 5: Kinematic Motor Analysis (Vision-Based)
- **Technology**: **MediaPipe Holistic** integration for sub-millimeter finger/hand tracking.
- **Active Tests**:
    - Finger Tapping (Clinical UPDRS standard).
    - Hand Opening/Closing Velocity.
    - Kinetic Tremor Frequency Analysis.
- **HUD**: Provides real-time diagnostic feedback to the user.

## Slide 6: SignBridge — The Communication Lifeline
- **Problem**: Speech loss in advanced patients leads to social isolation.
- **Solution**: Two-way ASL/Gesture-to-Speech pipeline.
- **Key Innovations**:
    - **Personalized Mapping**: Users can train the AI on their specific hand shapes (e.g., mapping a custom gesture to "WATER").
    - **AI Refinement**: Corrects "sloppy" signs using LLM-based context refinement.
    - **Hearing → Deaf**: Converts caregiver speech to simplified sign avatars.

## Slide 7: Clinical AI & Language Support
- **Engine**: XGBoost classifier trained on UCI Parkinson's datasets (95%+ accuracy).
- **BharatGen Integration**:
    - Multilingual Support via AI4Bharat.
    - Cultural nuances and dialect support for Indic languages.
- **Output**: Generates a "Fusion Report" with actionable recommendations (AAN Guidelines).

## Slide 8: Holistic Patient Ecosystem
- **Brain Gym**: Cognitive drills to slow neuro-degeneration.
- **RecipeMaker**: Precision nutrition (50+ recipes) optimized for PD medication.
- **Appointment Bot**: AI Triage for seamless specialist scheduling.
- **Gamification**: Reward loops to ensure daily screening compliance.

## Slide 9: Technical Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts, Three.js (Avatars).
- **Backend**: FastAPI (Python), SQLAlchemy, Parselmouth.
- **AI/ML**: XGBoost, MediaPipe, AI4Bharat Models.
- **Research**: Built using MDS-UPDRS & AAN Clinical Guidelines.

## Slide 10: Impact & Future Roadmap
- **Accessibility**: Democratizing neurological screening for 1 Billion+ people.
- **Impact**: Early detection can double the efficacy of neuro-protective therapies.
- **Roadmap**: Clinical pilot trials (2026), FDA/CDSCO certification, and support for Alzheimer’s/ALS.
