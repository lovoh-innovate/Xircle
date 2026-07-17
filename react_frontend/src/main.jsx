// main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './index.css';
import App from './App.jsx';
import store from './store';
import Login from './screens/Login.jsx';
import ForgotPassword from './screens/ForgotPassword.jsx';
import Signup from './screens/Signup.jsx';
import MyWorkspaces from './screens/MyWorkspaces.jsx';
import Profile from './screens/Profile.jsx';
import YourWorkspaceId from './screens/YourWorkspaceId.jsx';
import MyWorkspaceId from './workspaceScreens/MyWorkspaceId.jsx';

//My workspace
import MyWorkspaceChannels from './workspaceScreens/MyWorkspaceChannels.jsx';
import MyWorkspaceChannelId from './workspaceScreens/MyWorkspaceChannelId.jsx';
import MyWorkspaceProjects  from './workspaceScreens/MyWorkspaceProjects.jsx';
import MyWorkspaceProjectId from './workspaceScreens/MyWorkspaceProjectId.jsx';
import MyWorkspaceMembers from './workspaceScreens/MyWorkspaceMembers.jsx';
import MyWorkspaceDMs from './workspaceScreens/MyWorkspaceDMs.jsx';
import MyWorkspaceSettings from './workspaceScreens/MyWorkspaceSettings.jsx';
import MyWorkspaceCreateProject from './workspaceScreens/MyWorkspaceCreateProject.jsx';
import MyWorkspaceUpdateProject from './workspaceScreens/MyWorkspaceUpdateProject.jsx';

//Your channels
import YourWorkspaceChannels from './screens/YourWorkspaceChannels.jsx';
import YourWorkspaceChannelId from './screens/YourWorkspaceChannelId.jsx';
import YourWorkspaceDMs from './screens/YourWorkspaceDMs.jsx';
import YourWorkspaceProjects from './screens/YourWorkspaceProjects.jsx';
import YourWorkspaceProjectId from './screens/YourWorkspaceProjectId.jsx';


const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // ── Auth Routes ──
      { index: true, element: <a href="/login">Login</a> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <Signup /> },
      { path: 'forgot-password', element: <ForgotPassword /> },

      // ── Workspace Routes ──
      { path: 'my-workspaces', element: <MyWorkspaces /> },
      { path: 'workspace/:workspaceId', element: <YourWorkspaceId /> },
      { path: 'my-workspace/:workspaceId', element: <MyWorkspaceId /> },
      {path: 'my-workspace/:workspaceId/channels', element: <MyWorkspaceChannels />},
      {path: 'my-workspace/:workspaceId/chat/:chatId', element: <MyWorkspaceChannelId />},
      {path: 'my-workspace/:workspaceId/projects', element: <MyWorkspaceProjects />},
      {path: 'my-workspace/:workspaceId/project/:projectId', element: <MyWorkspaceProjectId />},
      {path: 'my-workspace/:workspaceId/members', element: <MyWorkspaceMembers />},
      {path: 'my-workspace/:workspaceId/dms', element: <MyWorkspaceDMs />},
      {path: 'my-workspace/:workspaceId/settings', element: <MyWorkspaceSettings />},
      { path: 'my-workspace/:workspaceId/projects/create', element: <MyWorkspaceCreateProject /> },
      { path: 'my-workspace/:workspaceId/projects/edit/:projectId', element: <MyWorkspaceUpdateProject /> },

      // ── Your Workspace Routes ──
      {path: 'workspace/:workspaceId/channels', element: <YourWorkspaceChannels />},
      {path: 'workspace/:workspaceId/chat/:chatId', element: <YourWorkspaceChannelId />},
      {path: 'workspace/:workspaceId/dms', element: <YourWorkspaceDMs />},
      { path: 'workspace/:workspaceId/projects', element: <YourWorkspaceProjects /> },
      { path: 'workspace/:workspaceId/project/:projectId', element: <YourWorkspaceProjectId /> },

      // ── Profile ──
      { path: 'profile', element: <Profile /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <StrictMode>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <RouterProvider router={router} />
      </GoogleOAuthProvider>
    </StrictMode>
  </Provider>
);