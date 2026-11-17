import '@fontsource/mulish/400.css';
import '@fontsource/mulish/700.css';
import '../../../src/theme/tokens.css';
import './ui/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
