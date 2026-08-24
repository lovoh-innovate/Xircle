// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useGoogleAuthMutation } from '../slices/userApiSlice';
import { setCredentials } from '../slices/authSlice';
import { toast } from 'react-hot-toast';
import { FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [googleAuth] = useGoogleAuthMutation();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      // Check for errors from Google
      if (error) {
        setStatus('error');
        setErrorMessage('Google authentication was cancelled or failed.');
        toast.error('Google authentication failed');
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received. Please try again.');
        toast.error('No authorization code received');
        return;
      }

      try {
        // Parse state to get mode
        let stateData = { mode: 'login' };
        try {
          stateData = JSON.parse(decodeURIComponent(state || '{}'));
        } catch (e) {}

        // Close the browser if this is a Capacitor app
        if (Capacitor.isNativePlatform()) {
          try {
            await Browser.close();
          } catch (e) {
            // Browser might already be closed
          }
        }

        // Authenticate with the code
        const result = await googleAuth({
          code,
          mode: stateData.mode || 'login',
        }).unwrap();

        dispatch(setCredentials({ ...result }));
        setStatus('success');
        toast.success(`${stateData.mode === 'login' ? 'Login' : 'Signup'} successful!`);

        // Redirect after a delay
        setTimeout(() => {
          navigate('/my-workspaces');
        }, 1500);

      } catch (err) {
        setStatus('error');
        setErrorMessage(err?.data?.message || 'Authentication failed. Please try again.');
        toast.error(err?.data?.message || 'Authentication failed');
      }
    };

    handleCallback();
  }, [location, navigate, dispatch, googleAuth]);

  // Render different states
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center max-w-md px-6">
          <FaSpinner className="animate-spin text-5xl text-teal-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
            Completing Authentication
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we verify your Google account...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center max-w-md px-6">
          <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
            Authentication Successful!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Redirecting to your workspace...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
      <div className="text-center max-w-md px-6">
        <FaTimesCircle className="text-6xl text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          Authentication Failed
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {errorMessage || 'Something went wrong. Please try again.'}
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default AuthCallback;