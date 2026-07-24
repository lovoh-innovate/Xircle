// main.jsx
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
import { Capacitor } from '@capacitor/core'; // <-- import Capacitor

import './index.css';
import store from './store';

// Socket provider
import { SocketProvider } from './components/SocketContext.jsx';

// Global call overlay
import IncomingCallModal from './components/IncomingCallModal.jsx';

// Auth routes
import Login from './screens/Login.jsx';
import ForgotPassword from './screens/ForgotPassword.jsx';
import Signup from './screens/Signup.jsx';
import Settings from './screens/Settings.jsx';

// Workspace routes (owner / member)
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

// Joined workspace sub‑routes
import YourWorkspaceChannels from './screens/YourWorkspaceChannels.jsx';
import YourWorkspaceChannelId from './screens/YourWorkspaceChannelId.jsx';
import YourWorkspaceDMs from './screens/YourWorkspaceDMs.jsx';
import YourWorkspaceProjects from './screens/YourWorkspaceProjects.jsx';
import YourWorkspaceProjectId from './screens/YourWorkspaceProjectId.jsx';

// Call screen
import CallScreen from './components/CallScreen.jsx';

// ── Mobile push hook ─────────────────────────────────────────────
import { useMobilePushNotifications } from './hooks/useMobilePushNotifications.js';

// ── Global navigator (exposes navigate for non-React code) ──────
const GlobalNavigator = () => {
  const navigate = useNavigate();
  useEffect(() => {
    window.__navigate = navigate;
    return () => {
      window.__navigate = null;
    };
  }, [navigate]);
  return null;
};

// ── Service worker registration (web only) ──────────────────────
const ServiceWorkerRegister = () => {
  useEffect(() => {
    // Only register SW on web (not on Capacitor)
    if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('✅ Service Worker registered'))
        .catch((err) => console.error('❌ Service Worker registration failed:', err));
    }
  }, []);
  return null;
};

// ── Mobile Push Initializer (Capacitor) ──────────────────────────
const PushNotificationInitializer = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { isSubscribed, permission, subscribe } = useMobilePushNotifications();

  useEffect(() => {
    // Only run on native platform and when user is logged in
    if (Capacitor.isNativePlatform() && userInfo?.token) {
      // If not subscribed and permission not denied, subscribe
      if (!isSubscribed && permission !== 'denied') {
        console.log('📱 Mobile push: auto‑subscribing…');
        subscribe();
      }
    }
  }, [userInfo, isSubscribed, permission, subscribe]);

  return null;
};

// ── Root layout ──────────────────────────────────────────────────
const RootLayout = () => {
  return (
    <>
      <GlobalNavigator />
      <Outlet />
      <IncomingCallModal />
    </>
  );
};

// ── Router definition ──────────────────────────────────────────
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

      // My workspace
      { path: 'my-workspace/:workspaceId/channels', element: <MyWorkspaceChannels /> },
      { path: 'my-workspace/:workspaceId/chat/:chatId', element: <MyWorkspaceChannelId /> },
      { path: 'my-workspace/:workspaceId/projects', element: <MyWorkspaceProjects /> },
      { path: 'my-workspace/:workspaceId/project/:projectId', element: <MyWorkspaceProjectId /> },
      { path: 'my-workspace/:workspaceId/members', element: <MyWorkspaceMembers /> },
      { path: 'my-workspace/:workspaceId/dms', element: <MyWorkspaceDMs /> },
      { path: 'my-workspace/:workspaceId/settings', element: <MyWorkspaceSettings /> },
      { path: 'my-workspace/:workspaceId/projects/create', element: <MyWorkspaceCreateProject /> },
      { path: 'my-workspace/:workspaceId/projects/edit/:projectId', element: <MyWorkspaceUpdateProject /> },

      // Joined workspace
      { path: 'workspace/:workspaceId/channels', element: <YourWorkspaceChannels /> },
      { path: 'workspace/:workspaceId/chat/:chatId', element: <YourWorkspaceChannelId /> },
      { path: 'workspace/:workspaceId/dms', element: <YourWorkspaceDMs /> },
      { path: 'workspace/:workspaceId/projects', element: <YourWorkspaceProjects /> },
      { path: 'workspace/:workspaceId/project/:projectId', element: <YourWorkspaceProjectId /> },

      { path: 'profile', element: <Profile /> },

      // Call screen
      { path: 'call/:roomId', element: <CallScreen /> },
    ],
  },
]);

// ── Root component ──────────────────────────────────────────────
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

// ── Final render ─────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <StrictMode>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <AppRoot />
      </GoogleOAuthProvider>
    </StrictMode>
  </Provider>
);