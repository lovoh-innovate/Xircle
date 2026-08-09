import React from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

const App = () => {
  return (
    <div>
      <Outlet />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1e1e2a',          // dark, sleek background
            color: '#f0f0f0',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            fontSize: '14px',
            fontWeight: 500,
          },
          success: {
            iconTheme: { primary: '#0d9488', secondary: '#fff' },
            style: {
              borderLeft: '4px solid #0d9488',
            },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
            style: {
              borderLeft: '4px solid #ef4444',
            },
          },
          loading: {
            iconTheme: { primary: '#f59e0b', secondary: '#fff' },
          },
        }}
      />
    </div>
  );
};

export default App;