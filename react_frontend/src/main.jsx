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

// ── ThemeProvider and useTheme ──────────────────────────────────────
import { ThemeProvider, useTheme } from './contexts/ThemeContext.jsx';

// ── Refresh Context ──────────────────────────────────────────────────
import { RefreshProvider, useRefresh } from './contexts/RefreshContext.jsx';

// ── Socket and Call ──────────────────────────────────────────────────
import { SocketProvider, useSocket } from './components/SocketContext.jsx';
import IncomingCallModal from './components/IncomingCallModal.jsx';

// ── Screens ──────────────────────────────────────────────────────────
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
import MyWorkspaceChatId from './workspaceScreens/MyWorkspaceChatId.jsx';
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

// General Screens 
import GeneralChannels from './screens/GeneralChannels.jsx';
import GeneralChannelId from './screens/GeneralChannelId.jsx';
import GeneralChats from './screens/GeneralChats.jsx';
import GeneralChatId from './screens/GeneralChatId.jsx';
import PersonalTasks from './screens/PersonalTasks.jsx';

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

  // Create channels on app start (Android)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const createChannels = async () => {
        try {
          await PushNotifications.createChannel({
            id: 'default',
            name: 'Default',
            importance: 4,
            visibility: 1,
            sound: 'default',
            vibration: true,
            lights: true,
            description: 'General notifications',
          });
          console.log('✅ Default channel created');

          await PushNotifications.createChannel({
            id: 'call_channel',
            name: 'Incoming Calls',
            importance: 4,
            visibility: 1,
            sound: 'ringtone',
            vibration: true,
            lights: true,
            bypassDnd: true,
            description: 'Incoming call notifications',
          });
          console.log('✅ Call channel created');
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

// ── Helper: build callData from push ──────────────────────────────────
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

// ── Root Layout ──────────────────────────────────────────────────────
const RootLayout = () => {
  const navigate = useNavigate();
  const { setIncomingCallFromPush, socket } = useSocket(); // get socket instance
  const { isDarkMode } = useTheme();
  const { refreshAll } = useRefresh();

  // ── Real‑time data updates via WebSocket ──────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Listen for data‑changed events from the server.
    // Adjust the event name to match your backend (e.g., 'data-updated', 'entity-changed', etc.)
    const handleDataChange = (data) => {
      console.log('🔄 Real‑time data update received:', data);
      refreshAll();
    };

    socket.on('data-changed', handleDataChange);

    return () => {
      socket.off('data-changed', handleDataChange);
    };
  }, [socket, refreshAll]);

  // ── Listen for Capacitor push events ───────────────────────────────
  useEffect(() => {
    const handlePushReceived = (event) => {
      const notification = event.detail;
      const data = notification?.data || {};

      if (data.notificationType === 'call' && data.roomId) {
        console.log('📞 Call push received in foreground:', data);
        setIncomingCallFromPush(buildCallDataFromPush(data));
        return;
      }

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

    const handlePushTapped = (event) => {
      const data = event.detail || {};
      console.log('📱 Push tapped data:', data);

      if (data.notificationType === 'call' && data.roomId) {
        setIncomingCallFromPush(buildCallDataFromPush(data));
        navigate(`/call/${data.roomId}?autoJoin=true`);
        return;
      }

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

      {/* ── Floating manual refresh button (fallback) ── */}
      {/* <button
        onClick={refreshAll}
        className="fixed bottom-24 right-4 z-50 p-3 bg-teal-600 dark:bg-[#0d9488] text-white rounded-full shadow-lg hover:opacity-80 active:scale-90 transition"
        aria-label="Refresh all data"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button> */}
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

      // General routes
      {path: 'channels', element: <GeneralChannels />},
      {path: 'channels/:chatId', element: <GeneralChannelId />},
      {path: 'chat', element: <GeneralChats />},
      {path: 'chats/:chatId', element: <GeneralChatId />},
      {path: 'personal-tasks', element: <PersonalTasks />},

      { path: 'my-workspaces', element: <MyWorkspaces /> },
      { path: 'workspace/:workspaceId', element: <YourWorkspaceId /> },
      { path: 'my-workspace/:workspaceId', element: <MyWorkspaceId /> },

      { path: 'my-workspace/:workspaceId/channels', element: <MyWorkspaceChannels /> },
      {path: 'my-workspace/:workspaceId/chat/:chatId', element: <MyWorkspaceChatId />},
      { path: 'my-workspace/:workspaceId/channels/:chatId', element: <MyWorkspaceChannelId /> },
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
      <ThemeProvider>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <RefreshProvider>
            <AppRoot />
          </RefreshProvider>
        </GoogleOAuthProvider>
      </ThemeProvider>
    </StrictMode>
  </Provider>
);