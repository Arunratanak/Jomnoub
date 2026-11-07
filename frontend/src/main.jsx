import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App';
import FeedbackHost from './components/FeedbackHost';
import './App.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID} locale="en">
      <BrowserRouter>
        <AuthProvider>
          {/* Follows the device's "reduce motion" setting everywhere */}
          <MotionConfig reducedMotion="user">
            <App />
            <FeedbackHost />
          </MotionConfig>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>
);