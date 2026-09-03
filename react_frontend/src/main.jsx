// main.jsx
import { StrictMode, useEffect, useRef, useState } from 'react';
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
import toast, { Toaster } from 'react-hot-toast';

// ─── NEW: SQLite & sync imports ──────────────────────────────────────
import { getDatabase } from './database/database';
import { syncManager } from './sync/syncManager';

// ─── Existing imports ────────────────────────────────────────────────
import './index.css';
import store from './store';

import PrivateRoute from './components/PrivateRoute.jsx';
import AppUpdateChecker from './components/AppUpdateChecker.jsx';
import Welcome from './screens/Welcome.jsx';

import { ThemeProvider, useTheme } from './contexts/ThemeContext.jsx';
import { RefreshProvider, useRefresh } from './contexts/RefreshContext.jsx';
import { SocketProvider, useSocket } from './components/SocketContext.jsx';
import IncomingCallModal from './components/IncomingCallModal.jsx';

import NotFound from './screens/NotFound.jsx';

import Login from './screens/Login.jsx';
import ForgotPassword from './screens/ForgotPassword.jsx';
import Signup from './screens/Signup.jsx';
import Settings from './screens/Settings.jsx';
import MyWorkspaces from './screens/MyWorkspaces.jsx';
import Profile from './screens/Profile.jsx';
import YourWorkspaceId from './screens/YourWorkspaceId.jsx';
import MyWorkspaceId from './workspaceScreens/MyWorkspaceId.jsx';
import Notifications from './screens/Notifications.jsx';
import AppVersions from './screens/AppVersions.jsx';
import AuthCallback from './screens/AuthCallback.jsx';
import Notes from './screens/Notes.jsx';
import WriteNote from './screens/WriteNote.jsx';
import AcceptTaskCollab from './screens/AcceptTaskCollab.jsx';

import AllTasks from './screens/AllTasks.jsx';

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
import MyWorkspaceClockin from './workspaceScreens/MyWorkspaceClockin.jsx';
import MyWorkspaceNotifications from './workspaceScreens/MyWorkspaceNotifications.jsx';

import YourWorkspaceChannels from './screens/YourWorkspaceChannels.jsx';
import YourWorkspaceChannelId from './screens/YourWorkspaceChannelId.jsx';
import YourWorkspaceDMs from './screens/YourWorkspaceDMs.jsx';
import YourWorkspaceProjects from './screens/YourWorkspaceProjects.jsx';
import YourWorkspaceProjectId from './screens/YourWorkspaceProjectId.jsx';
import YourWorkspaceMembers from './screens/YourWorkspaceMembers.jsx';
import YourWorkspaceClockin from './screens/YourWorkspaceClockin.jsx';
import YourWorkspaceNotifications from './screens/YourWorkspaceNotifications.jsx';

import CallScreen from './components/CallScreen.jsx';

import GeneralChannels from './screens/GeneralChannels.jsx';
import GeneralChannelId from './screens/GeneralChannelId.jsx';
import GeneralChats from './screens/GeneralChats.jsx';
import GeneralChatId from './screens/GeneralChatId.jsx';
import PersonalTasks from './screens/PersonalTasks.jsx';

import AppDownload from './screens/AppDownload';
import UploadApp from './screens/UploadApp.jsx';

import { PushNotificationProvider, usePushNotificationContext } from './contexts/PushNotificationContext.jsx';

// ─── NEW: AppInitializer – initializes SQLite and starts sync ──────
const AppInitializer = ({ children }) => {
  const { userInfo } = useSelector((state) => state.auth);
  const [dbReady, setDbReady] = useState(false);
  const initialSyncDone = useRef(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Open SQLite (creates tables if needed)
        await getDatabase();
        if (mounted) setDbReady(true);

        // 2. If user is logged in and we haven't synced yet, do initial sync
        if (userInfo?.token && !initialSyncDone.current) {
          initialSyncDone.current = true;
          await syncManager.initialSync();
          // Start background sync (every 30s) and outbox processing
          syncManager.startBackgroundSync(30000);
        }
      } catch (error) {
        console.error('❌ AppInitializer failed:', error);
        // Even on error, we set dbReady to true so the app renders
        if (mounted) setDbReady(true);
      }
    };

    init();

    return () => {
      mounted = false;
      syncManager.stopBackgroundSync();
    };
  }, [userInfo?.token]); // re-run when auth changes (login/logout)

  // Show nothing until DB is ready (you could show a splash screen here)
  if (!dbReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b0b10]">
        <div className="text-teal-400 text-xl">Loading...</div>
      </div>
    );
  }

  return children;
};

// ─── Global Pull‑to‑Refresh Component ──────────────────────────────
const PullToRefresh = ({ children }) => {
  const { refreshAll } = useRefresh(); // we'll keep using refreshAll, but it will call syncManager via RefreshContext later
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
  const { subscribe, unsubscribe, isNative } = usePushNotificationContext();

  useEffect(() => {
    if (!isNative) return;
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
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;
    if (userInfo?.token) {
      subscribe();
    } else {
      unsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.token, isNative]);

  return null;
};

// ── Web Push Initializer ──────────────────────────────────────────────
const WebPushInitializer = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { permission, subscribe, isSupported, isNative } = usePushNotificationContext();

  useEffect(() => {
    if (isNative) return;
    if (!isSupported) return;
    if (userInfo?.token && permission === 'granted') {
      subscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.token, permission, isSupported, isNative]);

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

// ── Route resolver from notification data ────────────────────────────
const routeFromNotificationData = (data, navigate) => {
  // ── App Update Notifications ──────────────────────────────────────
  if (data.type === 'app_update' || data.type === 'APP_UPDATE' || data.notificationType === 'app_update') {
    console.log('📱 Routing to app versions for update:', data.version);
    return '/app-versions';
  }

  if (data.type === 'version_updated' || data.type === 'upload_confirmation' || data.type === 'version_deleted') {
    return '/app-versions';
  }

  // ── Call Notifications ────────────────────────────────────────────
  if (data.notificationType === 'call' && data.roomId) {
    return `/call/${data.roomId}?autoJoin=true`;
  }

  // ── Chat/Channel Notifications ────────────────────────────────────
  if (data.chatId) {
    if (data.workspaceId) {
      return `/workspace/${data.workspaceId}/chat/${data.chatId}`;
    }
    const isGroup = data.notificationType === 'channel' || data.chatType === 'group';
    return isGroup ? `/channels/${data.chatId}` : `/chats/${data.chatId}`;
  }

  // ── Task Notifications ────────────────────────────────────────────
  if (data.taskId && data.projectId && data.workspaceId) {
    return `/workspace/${data.workspaceId}/project/${data.projectId}`;
  }

  // ── Project Notifications ─────────────────────────────────────────
  if (data.projectId && data.workspaceId) {
    return `/workspace/${data.workspaceId}/project/${data.projectId}`;
  }

  // ── Workspace Notifications ───────────────────────────────────────
  if (data.workspaceId) {
    return `/workspace/${data.workspaceId}`;
  }

  // ── Clock-in Notifications ────────────────────────────────────────
  if (data.type === 'clockin' || data.type === 'clockout' || 
      data.type === 'clockin-reminder' || data.type === 'auto-clockout' ||
      data.type === 'clockin-confirmation' || data.type === 'clockout-confirmation') {
    if (data.workspaceId) {
      return `/workspace/${data.workspaceId}/clockin`;
    }
  }

  // ── Default fallback ──────────────────────────────────────────────
  return '/my-workspaces';
};

// ── Root Layout ──────────────────────────────────────────────────────
const RootLayout = () => {
  const navigate = useNavigate();
  const { setIncomingCallFromPush, socket } = useSocket();
  const { isDarkMode } = useTheme();
  const { refreshAll } = useRefresh(); // keep for pull-to-refresh but socket will use syncManager

  useEffect(() => {
    if (!socket) return;

    // ─── CHANGED: socket 'data-changed' now triggers background sync ──
    const handleDataChange = async (data) => {
      console.log('🔄 Real‑time data update received:', data);
      // Instead of refreshAll() (which forces full refetch), we use
      // syncManager to fetch only changes and update SQLite.
      // This avoids unnecessary network load and improves speed.
      try {
        await syncManager.backgroundSync();
        await syncManager.processOutbox();
      } catch (err) {
        console.error('Background sync failed:', err);
      }
    };

    socket.on('data-changed', handleDataChange);

    return () => {
      socket.off('data-changed', handleDataChange);
    };
  }, [socket, refreshAll]); // refreshAll dependency kept but not used

  // ── Push notification handlers (unchanged) ────────────────────────
  useEffect(() => {
    const handlePushReceived = (event) => {
      const notification = event.detail;
      const data = notification?.data || {};
      console.log('📨 Push received in foreground:', data);

      // ── Handle App Update Notifications ──────────────────────────
      if (data.type === 'app_update' || data.type === 'APP_UPDATE' || data.notificationType === 'app_update') {
        const isRequired = data.isRequired === 'true' || data.isRequired === true;
        const version = data.version || 'new';
        
        toast(
          (t) => (
            <div className="flex flex-col gap-1 max-w-[280px]">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <span className="font-semibold text-sm">App Update v{version}</span>
                {isRequired && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                    Required
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{notification?.body || 'Tap to download the latest version'}</p>
            </div>
          ),
          {
            duration: 8000,
            style: {
              background: '#1e1e2a',
              color: '#f0f0f0',
              borderRadius: '16px',
              padding: '12px 16px',
              borderLeft: `4px solid ${isRequired ? '#ef4444' : '#fb923c'}`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            },
            icon: '📱',
          }
        );
        return;
      }

      // ── Handle Call Notifications ────────────────────────────────
      if (data.notificationType === 'call' && data.roomId) {
        console.log('📞 Call push received in foreground:', data);
        setIncomingCallFromPush(buildCallDataFromPush(data));
        return;
      }

      // ── Handle Other Notifications ───────────────────────────────
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

      // ── Handle App Update Taps ────────────────────────────────────
      if (data.type === 'app_update' || data.type === 'APP_UPDATE' || data.notificationType === 'app_update') {
        console.log('📱 User tapped app update notification, navigating to /app-versions');
        navigate('/app-versions');
        return;
      }

      // ── Handle Call Taps ──────────────────────────────────────────
      if (data.notificationType === 'call' && data.roomId) {
        setIncomingCallFromPush(buildCallDataFromPush(data));
        // Let the modal handle navigation
        return;
      }

      // ── Route all other notifications ────────────────────────────
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

      {/* ─── REMOVED: PreloadAppData – initial sync now handled by AppInitializer ── */}
      {/* <PreloadAppData /> */}

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
      {path: '*', element: <NotFound />},

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
          { path: 'my-workspace/:workspaceId/clockin', element: <MyWorkspaceClockin /> },
          { path: 'my-workspace/:workspaceId/tasks', element: <AllTasks /> },
          { path: 'my-workspace/:workspaceId/notifications', element: <MyWorkspaceNotifications /> },


          { path: 'workspace/:workspaceId/channels', element: <YourWorkspaceChannels /> },
          { path: 'workspace/:workspaceId/chat/:chatId', element: <YourWorkspaceChannelId /> },
          { path: 'workspace/:workspaceId/dms', element: <YourWorkspaceDMs /> },
          { path: 'workspace/:workspaceId/projects', element: <YourWorkspaceProjects /> },
          { path: 'workspace/:workspaceId/project/:projectId', element: <YourWorkspaceProjectId /> },
          { path: 'workspace/:workspaceId/members', element: <YourWorkspaceMembers /> },
          { path: 'workspace/:workspaceId/tasks', element: <AllTasks /> },
          { path: 'workspace/:workspaceId/clockin', element: <YourWorkspaceClockin /> },
          { path: 'workspace/:workspaceId/notifications', element: <YourWorkspaceNotifications /> },

          { path: 'profile', element: <Profile /> },

          { path: 'channels', element: <GeneralChannels /> },
          { path: 'channels/:chatId', element: <GeneralChannelId /> },
          { path: 'chat', element: <GeneralChats /> },
          { path: 'chats/:chatId', element: <GeneralChatId /> },
          { path: 'personal-tasks', element: <PersonalTasks /> },
          { path: 'notifications', element: <Notifications /> },
          {path: 'app-versions', element: <AppVersions />},
          {path: 'auth/google/callback', element: <AuthCallback />},
          {path: 'notes', element: <Notes />},
          {path: 'notes/:id', element: <WriteNote />},
          {path: 'accept-task-collab', element: <AcceptTaskCollab />},

          { path: 'call/:roomId', element: <CallScreen /> },

          { path: 'admin/upload', element: <UploadApp /> },
          {path: '*', element: <NotFound />},
        ],
      },
    ],
  },
]);

// ── AppRoot ───────────────────────────────────────────────────────────
const AppRoot = () => {
  const userInfo = useSelector((state) => state.auth?.userInfo);
  const token = userInfo?.token;

  return (
    <SocketProvider token={token}>
      <PushNotificationProvider>
        {/* ─── NEW: Wrap with AppInitializer ──────────────────────── */}
        <AppInitializer>
          <ServiceWorkerRegister />
          <PushNotificationInitializer />
          <WebPushInitializer />
          <RouterProvider router={router} />
        </AppInitializer>
      </PushNotificationProvider>
    </SocketProvider>
  );
};

// ─── Main render ────────────────────────────────────────────────────
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