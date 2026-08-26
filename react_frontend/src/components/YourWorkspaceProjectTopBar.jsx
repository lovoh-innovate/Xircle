// src/components/YourWorkspaceProjectTopBar.jsx
import React from 'react';
import { FaArrowLeft, FaFolder, FaSearch, FaPlus, FaEllipsisV } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const YourWorkspaceProjectTopBar = ({
  workspaceId,
  project,
  brandColor,
  activeTab,
  setActiveTab,
  onSearchOpen,
  onAddClick,
  onMenuOpen,
  isArchivedForMe,
  isTrash,
  tasksCount,
  teamCount,
}) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
      <div className="flex items-center justify-between px-3 md:px-4 h-14 lg:h-16">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(`/workspace/${workspaceId}/projects`)} className="p-1 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"><FaArrowLeft className="text-sm" /></button>
          <div className="flex items-center gap-2 min-w-0">
            {project.coverImage ? (
              <img src={project.coverImage} className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700/60" alt="" />
            ) : (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm md:text-base" style={{ backgroundColor: brandColor }}>
                <FaFolder className="text-base md:text-lg" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-xs flex items-center gap-1">
                {project.name}
                {isArchivedForMe && (
                  <span className="text-[10px] font-normal text-gray-400 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/40 px-1.5 py-0.5 rounded-full border border-gray-300 dark:border-gray-700/40">Archived</span>
                )}
                {isTrash && (
                  <span className="text-[10px] font-normal text-red-400 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full border border-red-300 dark:border-red-700/40">Trash</span>
                )}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-gray-500 dark:text-gray-400 truncate">
                <span>{teamCount} members</span>
                <span className="w-0.5 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                <span>{project.progress || 0}% done</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={onSearchOpen} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaSearch className="text-xs md:text-sm" /></button>
          <button onClick={onAddClick} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"><FaPlus className="text-xs md:text-sm" /></button>
          <button onClick={onMenuOpen} className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition">
            <FaEllipsisV className="text-xs md:text-sm" />
          </button>
        </div>
      </div>
      <div className="flex gap-4 md:gap-6 px-3 md:px-4 border-t border-gray-200/60 dark:border-gray-800/30 overflow-x-auto">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-2 text-xs md:text-sm font-medium transition whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Tasks ({tasksCount})
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`pb-2 text-xs md:text-sm font-medium transition whitespace-nowrap ${
            activeTab === 'team'
              ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Team ({teamCount})
        </button>
      </div>
    </header>
  );
};

export default YourWorkspaceProjectTopBar;