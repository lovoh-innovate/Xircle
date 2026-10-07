// src/components/YourWorkspaceLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import YourWorkspaceSidebar from './YourWorkspaceSidebar';

const YourWorkspaceLayout = ({ workspace, chats }) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-[#18181b]">
      {/* Sidebar slot — fixed width, never squashed */}
      <div className="flex-shrink-0 h-full">
        <YourWorkspaceSidebar workspace={workspace} chats={chats} />
      </div>

      {/* Main content — takes remaining space, scrolls independently */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        <Outlet context={{ workspace, chats }} />
      </main>
    </div>
  );
};

export default YourWorkspaceLayout;