import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useNavigate,
} from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './index.css';
import store from './store';

// ── Import ThemeProvider and useTheme ──────────────────────────────
import { ThemeProvider, useTheme } from './contexts/ThemeContext.jsx';

import { SocketProvider, useSocket } from './components/SocketContext.jsx';
import IncomingCallModal from './components/IncomingCallModal.jsx';

import Login from './screens/Login.jsx';
import ForgotPassword from './screens/ForgotPassword.jsx';
import Signup from './screens/Signup.jsx';
import Settings from './screens/Settings.jsx';
import MyWorkspaces from './screens/MyWorkspaces.jsx';
import Profile from './screens/Profile.jsx';
import YourWorkspaceId from './screens/YourWorkspaceId.jsx';
import MyWorkspaceId from './workspaceScreens/MyWorkspaceId.jsx';

// My workspace sub‑routes
import MyWorkspaceChannels from './workspaceScreens/MyWorkspaceChannels.jsx';
import MyWorkspaceChannelId from './workspaceScreens/MyWorkspaceChannelId.jsx';
import MyWorkspaceProjects from './workspaceScreens/MyWorkspaceProjects.jsx';
import MyWorkspaceProjectId from './workspaceScreens/MyWorkspaceProjectId.jsx';
import MyWorkspaceMembers from './workspaceScreens/MyWorkspaceMembers.jsx';
import MyWorkspaceDMs from './workspaceScreens/MyWorkspaceDMs.jsx';
import MyWorkspaceSettings from './workspaceScreens/MyWorkspaceSettings.jsx';
import MyWorkspaceCreateProject from './workspaceScreens/MyWorkspaceCreateProject.jsx';
import MyWorkspaceUpdateProject from './workspaceScreens/MyWorkspaceUpdateProject.jsx';

import YourWorkspaceChannels from './screens/YourWorkspaceChannels.jsx';
import YourWorkspaceChannelId from './screens/YourWorkspaceChannelId.jsx';
import YourWorkspaceDMs from './screens/YourWorkspaceDMs.jsx';
import YourWorkspaceProjects from './screens/YourWorkspaceProjects.jsx';
import YourWorkspaceProjectId from './screens/YourWorkspaceProjectId.jsx';

import CallScreen from './components/CallScreen.jsx';

import { useMobilePushNotifications } from './hooks/useMobilePushNotifications.js';

// ── Global navigator ──────────────────────────────────────────────────
const GlobalNavigator = () => {
  const navigate = useNavigate();
  useEffect(() => {
    window.__navigate = navigate;
    return () => { window.__navigate = null; };
  }, [navigate]);
  return null;
};

// ── Service worker registration ──────────────────────────────────────
const ServiceWorkerRegister = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('✅ Service Worker registered'))
        .catch((err) => console.error('❌ Service Worker registration failed:', err));
    }
  }, []);
  return null;
};

// ── Mobile Push Initializer ───────────────────────────────────────────
const PushNotificationInitializer = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { permission, subscribe, unsubscribe } = useMobilePushNotifications();

  // Create both channels on app start (Android)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const createChannels = async () => {
        try {
          // 1. Default channel for messages & other notifications
          //    IMPORTANCE 4 (HIGH) enables heads‑up pop‑ups on most devices.
          await PushNotifications.createChannel({
            id: 'default',
            name: 'Default',
            importance: 4,          // ← fixed: HIGH for pop‑up banners
            visibility: 1,
            sound: 'default',
            vibration: true,
            lights: true,
            description: 'General notifications',
          });
          console.log('✅ Default channel created (heads‑up enabled)');

          // 2. Call channel – MAX importance, full‑screen intent, bypass DND
          await PushNotifications.createChannel({
            id: 'call_channel',
            name: 'Incoming Calls',
            importance: 4,                 // MAX
            visibility: 1,                // PUBLIC
            sound: 'ringtone',            // must be in resources
            vibration: true,
            lights: true,
            bypassDnd: true,              // override Do Not Disturb
            description: 'Incoming call notifications',
          });
          console.log('✅ Call channel created with full‑screen intent');
        } catch (err) {
          console.warn('Could not create notification channels:', err);
        }
      };
      createChannels();
    }
  }, []);

  // Subscribe on login, unsubscribe on logout
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (userInfo?.token) {
      if (permission !== 'denied') {
        subscribe();
      }
    } else {
      unsubscribe();
    }
  }, [userInfo, permission, subscribe, unsubscribe]);

  return null;
};

// ── Helper: build a normalized callData object from raw push data ──────
const buildCallDataFromPush = (data) => ({
  callId: data.callId,
  roomId: data.roomId,
  type: data.type || 'voice',
  participants: data.participants || [],
  caller: data.caller || { name: data.callerName || 'Unknown Caller' },
  workspaceId: data.workspaceId,
  workspaceColor: data.workspaceColor || '#0d9488',
  status: 'ringing',
  isInitiator: false,
});

// ── Root layout ──────────────────────────────────────────────────────
const RootLayout = () => {
  const navigate = useNavigate();
  const { setIncomingCallFromPush } = useSocket();
  const { isDarkMode } = useTheme(); // 👈 get current theme for toast

  // ── Listen for Capacitor push events (foreground + tap) ───────────
  useEffect(() => {
    const handlePushReceived = (event) => {
      const notification = event.detail;
      const data = notification?.data || {};

      // ── CALL NOTIFICATION (foreground) ──────────────────────────
      if (data.notificationType === 'call' && data.roomId) {
        console.log('📞 Call push received in foreground:', data);
        setIncomingCallFromPush(buildCallDataFromPush(data));
        return;
      }

      // ── MESSAGE NOTIFICATION (foreground) ──────────────────────
      if (notification?.title && notification?.body) {
        toast.info(`${notification.title}: ${notification.body}`, {
          onClick: () => {
            if (data.chatId && data.workspaceId) {
              navigate(`/workspace/${data.workspaceId}/chat/${data.chatId}`);
            }
          }
        });
      }
    };

    // Fired both by the Capacitor push plugin (background tap) AND by
    // MainActivity.java's native call notification tap (dispatched from
    // MyFirebaseMessagingService's full‑screen intent flow).
    const handlePushTapped = (event) => {
      const data = event.detail || {};
      console.log('📱 Push tapped data:', data);

      // Handle call notifications: populate SocketContext BEFORE navigating
      // so CallScreen has callData available the moment it mounts, instead
      // of relying on location.state (which a plain URL navigation never sets).
      if (data.notificationType === 'call' && data.roomId) {
        setIncomingCallFromPush(buildCallDataFromPush(data));
        navigate(`/call/${data.roomId}?autoJoin=true`);
        return;
      }

      // Handle chat navigation
      if (data.chatId && data.workspaceId) {
        navigate(`/workspace/${data.workspaceId}/chat/${data.chatId}`);
      } else {
        navigate('/my-workspaces');
      }
    };

    window.addEventListener('mobile-push-received', handlePushReceived);
    window.addEventListener('mobile-push-tapped', handlePushTapped);

    return () => {
      window.removeEventListener('mobile-push-received', handlePushReceived);
      window.removeEventListener('mobile-push-tapped', handlePushTapped);
    };
  }, [navigate, setIncomingCallFromPush]);

  return (
    <div className="bg-gray-50 dark:bg-[#0b0b10] min-h-screen w-full transition-colors duration-300">
      <GlobalNavigator />
      <Outlet />
      <IncomingCallModal />
      <ToastContainer
        position="bottom-center"
        autoClose={4000}
        hideProgressBar={false}
        theme={isDarkMode ? 'dark' : 'light'}
      />
    </div>
  );
};

// ── Router ────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Login /> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <Signup /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'settings', element: <Settings /> },

      { path: 'my-workspaces', element: <MyWorkspaces /> },
      { path: 'workspace/:workspaceId', element: <YourWorkspaceId /> },
      { path: 'my-workspace/:workspaceId', element: <MyWorkspaceId /> },

      { path: 'my-workspace/:workspaceId/channels', element: <MyWorkspaceChannels /> },
      { path: 'my-workspace/:workspaceId/chat/:chatId', element: <MyWorkspaceChannelId /> },
      { path: 'my-workspace/:workspaceId/projects', element: <MyWorkspaceProjects /> },
      { path: 'my-workspace/:workspaceId/project/:projectId', element: <MyWorkspaceProjectId /> },
      { path: 'my-workspace/:workspaceId/members', element: <MyWorkspaceMembers /> },
      { path: 'my-workspace/:workspaceId/dms', element: <MyWorkspaceDMs /> },
      { path: 'my-workspace/:workspaceId/settings', element: <MyWorkspaceSettings /> },
      { path: 'my-workspace/:workspaceId/projects/create', element: <MyWorkspaceCreateProject /> },
      { path: 'my-workspace/:workspaceId/projects/edit/:projectId', element: <MyWorkspaceUpdateProject /> },

      { path: 'workspace/:workspaceId/channels', element: <YourWorkspaceChannels /> },
      { path: 'workspace/:workspaceId/chat/:chatId', element: <YourWorkspaceChannelId /> },
      { path: 'workspace/:workspaceId/dms', element: <YourWorkspaceDMs /> },
      { path: 'workspace/:workspaceId/projects', element: <YourWorkspaceProjects /> },
      { path: 'workspace/:workspaceId/project/:projectId', element: <YourWorkspaceProjectId /> },

      { path: 'profile', element: <Profile /> },

      { path: 'call/:roomId', element: <CallScreen /> },
    ],
  },
]);

// ── AppRoot ───────────────────────────────────────────────────────────
const AppRoot = () => {
  const userInfo = useSelector((state) => state.auth?.userInfo);
  const token = userInfo?.token;

  return (
    <SocketProvider token={token}>
      <ServiceWorkerRegister />
      <PushNotificationInitializer />
      <RouterProvider router={router} />
    </SocketProvider>
  );
};

// ── Render ────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <StrictMode>
      {/* ✅ ThemeProvider wraps the entire app */}
      <ThemeProvider>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <AppRoot />
        </GoogleOAuthProvider>
      </ThemeProvider>
    </StrictMode>
  </Provider>
);