// pages/AcceptTaskCollab.jsx
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAcceptInvitationWithTokenMutation } from '../slices/personalTaskApiSlice';
import toast from 'react-hot-toast';
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaUserPlus } from 'react-icons/fa';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

const AcceptTaskCollab = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);

  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const [acceptInvitation, { isLoading }] = useAcceptInvitationWithTokenMutation();

  // Extract token from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setStatus('error');
      setErrorMsg('Invalid invitation link. Token is missing.');
    }
  }, [location.search]);

  // If not authenticated, redirect to login
  useEffect(() => {
    if (!userInfo && token) {
      // Redirect to login with return URL
      const redirectTo = encodeURIComponent(`/accept-task-collab?token=${token}`);
      navigate(`/login?redirect=${redirectTo}`);
    }
  }, [userInfo, token, navigate]);

  const handleAccept = async () => {
    if (!token) return;
    setStatus('loading');
    try {
      await acceptInvitation({ token }).unwrap();
      setStatus('success');
      toast.success('Invitation accepted successfully!');
      // Optionally navigate to personal tasks after a delay
      setTimeout(() => {
        navigate('/personal-tasks');
      }, 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err?.data?.message || 'Failed to accept invitation. The link may have expired.');
      toast.error(errorMsg);
    }
  };

  // Show loading while checking auth or token
  if (!token && status === 'idle') {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>
        <div className="flex-1 flex items-center justify-center">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  // If not authenticated, we return null because the redirect effect will run
  if (!userInfo) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <FaUserPlus className="text-3xl text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 dark:text-white text-center mb-2">
              Collaboration Invitation
            </h2>

            {status === 'loading' && (
              <div className="text-center py-6">
                <FaSpinner className="animate-spin text-teal-500 text-4xl mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Accepting invitation...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center py-6">
                <FaCheckCircle className="text-green-500 text-4xl mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-800 dark:text-white">
                  Invitation accepted!
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Redirecting to your tasks...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-6">
                <FaTimesCircle className="text-red-500 text-4xl mx-auto mb-3" />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  {errorMsg || 'Something went wrong.'}
                </p>
                <button
                  onClick={() => navigate('/personal-tasks')}
                  className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
                >
                  Go to Tasks
                </button>
              </div>
            )}

            {status === 'idle' && token && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                  You have been invited to collaborate on a task. Accept to start collaborating.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/personal-tasks')}
                    className="flex-1 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={isLoading}
                    className="flex-1 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {isLoading ? <FaSpinner className="animate-spin" /> : 'Accept Invitation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <GeneralBottombar />
      </div>
    </>
  );
};

export default AcceptTaskCollab;