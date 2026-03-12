import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId='946753883098-bgnbv8vkdtef27ng9mp55anc2c7cjhf9.apps.googleusercontent.com'>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);
