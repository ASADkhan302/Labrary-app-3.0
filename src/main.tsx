import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initButtonRippleEngine } from './lib/buttonAnimations';
import './index.css';

// Initialize global premium button micro-interactions
initButtonRippleEngine();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
