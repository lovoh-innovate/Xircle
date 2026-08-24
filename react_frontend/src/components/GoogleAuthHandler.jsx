// src/components/GoogleAuthHandler.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useGoogleAuthMutation } from '../slices/userApiSlice';
import { setCredentials } from '../slices/authSlice';
import { toast } from 'react-hot-toast';

export const useGoogleAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [googleAuth] = useGoogleAuthMutation();

  useEffect(() => {
    // Listen for app URL events (deep links from the browser)
    const handler = App.addListener('appUrlOpen', async (data) => {
      console.log('🔗 App URL opened:', data.url);
      
      // Check if it's our auth callback from the web
      if (data.url.includes('/auth/google/callback')) {
        const url = new URL(data.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (code) {
          try {
            // Parse state to get mode
            let stateData = { mode: 'login' };
            try {
              stateData = JSON.parse(decodeURIComponent(state || '{}'));
            } catch (e) {}
            
            // Close the browser if it was opened
            await Browser.close();
            
            // Show loading
            toast.loading('Authenticating...', { duration: 10000 });
            
            // Authenticate with the code
            const result = await googleAuth({
              code,
              mode: stateData.mode || 'login',
            }).unwrap();
            
            dispatch(setCredentials({ ...result }));
            toast.dismiss();
            toast.success(`${stateData.mode === 'login' ? 'Login' : 'Signup'} successful!`);
            navigate('/my-workspaces');
          } catch (error) {
            toast.dismiss();
            console.error('Auth error:', error);
            toast.error(error?.data?.message || 'Authentication failed');
            navigate('/login');
          }
        }
      }
    });

    return () => {
      handler.remove();
    };
  }, [dispatch, navigate, googleAuth]);

  const openGoogleAuth = async (mode = 'login') => {
    try {
      // Build the Google OAuth URL - redirect to your web domain
      const redirectUri = 'https://xircle.lovohcreate.com/auth/google/callback';
      const state = JSON.stringify({ mode });
      
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=email%20profile&` +
        `access_type=online&` +
        `state=${encodeURIComponent(state)}`;

      console.log('🔑 Opening Google Auth:', googleAuthUrl);

      // Open in browser
      await Browser.open({
        url: googleAuthUrl,
        presentationStyle: 'fullscreen',
        toolbarColor: '#0d9488',
      });
    } catch (error) {
      console.error('Google auth error:', error);
      throw error;
    }
  };

  return { openGoogleAuth };
};