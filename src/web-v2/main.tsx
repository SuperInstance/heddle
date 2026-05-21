import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ControlPlaneApiProvider } from '@web/api/ControlPlaneApiProvider';
import { App } from '@web/App';
import { I18nProvider } from '@web/i18n';
import './tailwind.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ControlPlaneApiProvider>
      <I18nProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </ControlPlaneApiProvider>
  </StrictMode>,
);
