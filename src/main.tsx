import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/montserrat';
import '@fontsource-variable/geist-mono';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/support.css';
import './styles/admin.css';
import './styles/shadcn.css';
import { App } from './App';
import { BootError } from './components/BootError';
import { createServices } from './services/registry';

const el = document.getElementById('root');
if (!el) throw new Error('Root element missing');
const root = createRoot(el);

createServices()
  .then((services) =>
    root.render(
      <StrictMode>
        <App services={services} />
      </StrictMode>,
    ),
  )
  .catch((e: unknown) => root.render(<BootError error={e} />));
