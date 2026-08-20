// main.jsx
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useNavigate,
} from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import toast, { Toaster } from 'react-hot-toast';   // ✅ toast now actually imported
import PreloadAppData from './components/PreloadAppData.jsx';

import './index.css';
import store, { persistor } from './store';

import PrivateRoute from './components/PrivateRoute.jsx';
import AppUpdateChecker from './components/AppUpdateChecker.jsx';
import Welcome from './screens/Welcome.jsx';

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

import AllTasks from './screens/AllTasks.jsx';

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

import AppDownload from './screens/AppDownload';
//Admin
import UploadApp from './screens/UploadApp.jsx';

import { useMobilePushNotifications } from './hooks/useMobilePushNotifications.js';

// ─── Global Pull‑to‑Refresh Component ──────────────────────────────
const PullToRefresh = ({ children }) => {
  const { refreshAll } = useRefresh();
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pullDistance.current = 0;
      }
    };

    const handleTouchMove = (e) => {
      if (startY.current === 0) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        pullDistance.current = delta;
        if (delta > 60) e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance.current > 80) {
        setRefreshing(true);
        refreshAll();
        setTimeout(() => setRefreshing(false), 1000);
      }
      startY.current = 0;
      pullDistance.current = 0;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [refreshAll]);

  return (
    <div ref={containerRef} className="relative min-h-screen">
      {refreshing && (
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-4 z-50 pointer-events-none">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-sm shadow-lg p-1" />
        </div>
      )}
      {children}
    </div>
  );
};

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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (userInfo?.token) {
      subscribe();
    } else {
      unsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.token]);

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

// ── Helper: route a tapped push notification to the right screen ──────
//
// Payload shapes actually seen from the backend (verified against
// callController.js, messagingController.js, socket.js, taskController.js,
// projectController.js, teamController.js, workspaceController.js):
//
//   Calls               → { notificationType: 'call', roomId, callId, type }
//   Chats/channels (REST)→ { notificationType: 'chat'|'channel', chatId, workspaceId, scope, messageId }
//   Chats (socket path)  → { chatId, chatType, chatName, senderName, url, messageId, workspaceId? }
//     ⚠️ socket.js's send-message handler does NOT set notificationType —
//     so we key off chatId presence, not notificationType, to catch both.
//   Tasks                → { taskId, projectId }  — NO workspaceId, ever.
//   Projects (most)       → { projectId } only — workspaceId is missing
//     except in createProject, which sends { projectId, workspaceId }.
//   Workspace/team events → { workspaceId } (sometimes with extra fields)
//   System (deletions)    → { notificationType: 'system' } — nothing to open
//
// Because taskId/projectId pushes usually lack workspaceId, we can only
// build a full route when workspaceId happens to be present. Otherwise we
// fall back instead of guessing — see the note at the bottom of this file
// on the backend fix needed to close that gap completely.
const routeFromNotificationData = (data, navigate) => {
  // 1. Calls
  if (data.notificationType === 'call' && data.roomId) {
    return `/call/${data.roomId}?autoJoin=true`;
  }

  // 2. Chats / channels — key off chatId, not notificationType, since the
  //    socket.js send-message path never sets notificationType.
  if (data.chatId) {
    if (data.workspaceId) {
      return `/workspace/${data.workspaceId}/chat/${data.chatId}`;
    }
    // Public chat/channel outside any workspace
    return `/channels/${data.chatId}`;
  }

  // 3. Tasks — no dedicated task-detail route exists yet, so the closest
  //    we can land on is the project screen (requires workspaceId, which
  //    taskController.js doesn't currently send — see backend note below).
  if (data.taskId && data.projectId && data.workspaceId) {
    return `/workspace/${data.workspaceId}/project/${data.projectId}`;
  }

  // 4. Projects
  if (data.projectId && data.workspaceId) {
    return `/workspace/${data.projectId ? data.workspaceId : ''}/project/${data.projectId}`;
  }

  // 5. Workspace / team notifications
  if (data.workspaceId) {
    return `/workspace/${data.workspaceId}`;
  }

  // 6. Nothing routable in the payload
  return '/my-workspaces';
};

// ── Root Layout ──────────────────────────────────────────────────────
const RootLayout = () => {
  const navigate = useNavigate();
  const { setIncomingCallFromPush, socket } = useSocket();
  const { isDarkMode } = useTheme();
  const { refreshAll } = useRefresh();

  // ── Real‑time data updates via WebSocket ──────────────────────────
  useEffect(() => {
    if (!socket) return;

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
        toast(`${notification.title}: ${notification.body}`, {
          icon: 'ℹ️',
          duration: 5000,
        });
      }
    };

    const handlePushTapped = (event) => {
      const data = event.detail || {};
      console.log('📱 Push tapped data:', data);

      if (data.notificationType === 'call' && data.roomId) {
        setIncomingCallFromPush(buildCallDataFromPush(data));
      }

      const target = routeFromNotificationData(data, navigate);
      navigate(target);
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

      <PreloadAppData />

      <PullToRefresh>
        <Outlet />
      </PullToRefresh>
      <IncomingCallModal />
      <AppUpdateChecker />

      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e1e2a',
            color: '#f0f0f0',
            borderRadius: '16px',
            padding: '14px 20px',
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

// ── Router ────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Welcome /> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <Signup /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'app/download/:versionId', element: <AppDownload /> },

      {
        element: <PrivateRoute />,
        children: [
          { path: 'settings', element: <Settings /> },
          { path: 'my-workspaces', element: <MyWorkspaces /> },
          { path: 'workspace/:workspaceId', element: <YourWorkspaceId /> },
          { path: 'my-workspace/:workspaceId', element: <MyWorkspaceId /> },

          { path: 'my-workspace/:workspaceId/channels', element: <MyWorkspaceChannels /> },
          { path: 'my-workspace/:workspaceId/chat/:chatId', element: <MyWorkspaceChatId /> },
          { path: 'my-workspace/:workspaceId/channels/:chatId', element: <MyWorkspaceChannelId /> },
          { path: 'my-workspace/:workspaceId/projects', element: <MyWorkspaceProjects /> },
          { path: 'my-workspace/:workspaceId/project/:projectId', element: <MyWorkspaceProjectId /> },
          { path: 'my-workspace/:workspaceId/members', element: <MyWorkspaceMembers /> },
          { path: 'my-workspace/:workspaceId/dms', element: <MyWorkspaceDMs /> },
          { path: 'my-workspace/:workspaceId/settings', element: <MyWorkspaceSettings /> },
          { path: 'my-workspace/:workspaceId/projects/create', element: <MyWorkspaceCreateProject /> },
          { path: 'my-workspace/:workspaceId/projects/edit/:projectId', element: <MyWorkspaceUpdateProject /> },
          { path: 'my-workspace/:workspaceId/tasks', element: <AllTasks /> },

          { path: 'workspace/:workspaceId/channels', element: <YourWorkspaceChannels /> },
          { path: 'workspace/:workspaceId/chat/:chatId', element: <YourWorkspaceChannelId /> },
          { path: 'workspace/:workspaceId/dms', element: <YourWorkspaceDMs /> },
          { path: 'workspace/:workspaceId/projects', element: <YourWorkspaceProjects /> },
          { path: 'workspace/:workspaceId/project/:projectId', element: <YourWorkspaceProjectId /> },
          { path: 'workspace/:workspaceId/tasks', element: <AllTasks /> },

          { path: 'profile', element: <Profile /> },

          { path: 'channels', element: <GeneralChannels /> },
          { path: 'channels/:chatId', element: <GeneralChannelId /> },
          { path: 'chat', element: <GeneralChats /> },
          { path: 'chats/:chatId', element: <GeneralChatId /> },
          { path: 'personal-tasks', element: <PersonalTasks /> },

          { path: 'call/:roomId', element: <CallScreen /> },

          { path: 'admin/upload', element: <UploadApp /> },
        ],
      },
    ],
  },
]);

// ─── Loading screen while persisting data ──────────────────────────
const PersistLoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-t-teal-600 dark:border-t-[#0d9488] border-gray-200 dark:border-gray-800 rounded-full animate-spin" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">Loading your workspace...</p>
    </div>
  </div>
);

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

// ─── Main render with PersistGate ──────────────────────────────────
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <StrictMode>
      <ThemeProvider>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <RefreshProvider>
            <PersistGate loading={<PersistLoadingScreen />} persistor={persistor}>
              <AppRoot />
            </PersistGate>
          </RefreshProvider>
        </GoogleOAuthProvider>
      </ThemeProvider>
    </StrictMode>
  </Provider>
);