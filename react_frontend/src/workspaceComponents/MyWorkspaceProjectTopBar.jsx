// src/workspaceComponents/MyWorkspaceProjectTopBar.jsx
import React from 'react';
import { FaArrowLeft, FaFolder, FaSearch, FaPlus, FaUsers, FaChartLine } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const MyWorkspaceProjectTopBar = ({
  workspaceId,
  project,
  brandColor,
  activeTab,
  setActiveTab,
  onSearchOpen,
  onAddClick,
  onAddMemberClick,
  projectProgress,
  teamCount,
  canManage,
}) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/40 flex-shrink-0">
      <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft className="text-sm" /></button>
          <div className="flex items-center gap-2 min-w-0">
            {project.coverImage ? (
              <img src={project.coverImage} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60" alt="" />
            ) : (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm md:text-base" style={{ backgroundColor: brandColor }}>
                <FaFolder className="text-base md:text-lg" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-xs">{project.name}</h1>
              <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <FaChartLine className="text-[#0d9488] text-[8px] md:text-[10px]" />
                  {projectProgress}% done
                </span>
                <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-gray-600 rounded-full" />
                <span className="flex items-center gap-1">
                  <FaUsers className="text-[8px] md:text-[10px]" />
                  {teamCount} members
                  {canManage && (
                    <button onClick={onAddMemberClick} className="text-[#0d9488] hover:text-[#14b8a6] transition ml-0.5">
                      <FaPlus className="text-[8px] md:text-[10px]" />
                    </button>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={onSearchOpen} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaSearch className="text-xs md:text-sm" /></button>
          {canManage && activeTab === 'tasks' && (
            <button onClick={onAddClick} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaPlus className="text-xs md:text-sm" /></button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 md:px-4 border-t border-gray-200 dark:border-gray-800/30 overflow-x-auto scrollbar-hide py-1">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-shrink-0 text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'bg-[#0d9488]/10 text-[#0d9488]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-shrink-0 text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
            activeTab === 'team'
              ? 'bg-[#0d9488]/10 text-[#0d9488]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Team
        </button>
      </div>
    </header>
  );
};

export default MyWorkspaceProjectTopBar;