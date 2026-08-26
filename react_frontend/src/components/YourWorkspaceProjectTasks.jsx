// src/components/YourWorkspaceProjectTasks.jsx
import React, { useState, useRef } from 'react';
import { FaFolder, FaPlus, FaEdit, FaUserLock, FaTrashAlt, FaTasks } from 'react-icons/fa';
import { TaskCard } from './ProjectHelpers';

const YourWorkspaceProjectTasks = ({
  tasks,
  folders,
  selectedFolderId,
  onFolderSelect,
  onTaskClick,
  selectedTaskId,
  brandColor,
  canManage,
  isTrash,
  isArchivedForMe,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onManageReadOnly,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDragOver,
  onTaskDragLeave,
  onTaskDrop,
  dragOverTaskId,
  canReorderTasks,
}) => {
  const [folderMenuOpen, setFolderMenuOpen] = useState(null);
  const longPressTimer = useRef(null);

  const handleTouchStart = (e, folderId) => {
    longPressTimer.current = setTimeout(() => {
      setFolderMenuOpen(folderId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleTouchMove = () => {
    clearTimeout(longPressTimer.current);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Folder bar */}
      <div className="border-b border-gray-200/60 dark:border-gray-800/30 px-2 md:px-3 py-2 bg-gray-50 dark:bg-[#14141a]/60">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Folders</span>
          {canManage && !isTrash && !isArchivedForMe && (
            <button onClick={onCreateFolder} className="text-[10px] md:text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition font-medium flex items-center gap-1">
              <FaPlus className="text-[8px] md:text-[10px]" /> New
            </button>
          )}
        </div>
        <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
          <button
            onClick={() => onFolderSelect(null)}
            className={`text-[10px] md:text-xs px-2 py-1 rounded-full border transition whitespace-nowrap ${
              !selectedFolderId
                ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600 dark:border-[#0d9488]'
                : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/30'
            }`}
          >
            All
          </button>
          {folders.map(f => (
            <div key={f._id} className="relative group flex items-center shrink-0">
              <button
                onClick={() => onFolderSelect(f._id)}
                onTouchStart={(e) => handleTouchStart(e, f._id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                className={`text-[10px] md:text-xs px-2 py-1 rounded-full border transition flex items-center gap-1 whitespace-nowrap ${
                  selectedFolderId === f._id
                    ? 'bg-teal-600 dark:bg-[#0d9488] text-white border-teal-600 dark:border-[#0d9488]'
                    : 'bg-gray-100 dark:bg-[#1e1e26] border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/30'
                }`}
              >
                <FaFolder className="text-[8px] md:text-[10px]" />
                <span className="truncate max-w-[50px] md:max-w-[80px]">{f.name}</span>
              </button>
              {canManage && !isTrash && !isArchivedForMe && (
                <div className="hidden md:flex items-center gap-0.5 ml-0.5">
                  <button onClick={(e) => { e.stopPropagation(); onEditFolder(f); }} className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
                    <FaEdit className="text-[8px]" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onManageReadOnly(f); }} className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-teal-500 dark:hover:text-teal-400 transition">
                    <FaUserLock className="text-[8px]" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(f); }} className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition">
                    <FaTrashAlt className="text-[8px]" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Mobile folder menu */}
        {folderMenuOpen && canManage && !isTrash && !isArchivedForMe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4" onClick={() => setFolderMenuOpen(null)}>
            <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setFolderMenuOpen(null); onEditFolder(folders.find(f => f._id === folderMenuOpen)); }} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition">
                  <FaEdit className="text-blue-500" /> Edit Folder
                </button>
                <button onClick={() => { setFolderMenuOpen(null); onManageReadOnly(folders.find(f => f._id === folderMenuOpen)); }} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition">
                  <FaUserLock className="text-teal-500" /> Read-Only Users
                </button>
                <button onClick={() => { setFolderMenuOpen(null); const f = folders.find(f => f._id === folderMenuOpen); if (f) onDeleteFolder(f); }} className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-800/30 transition text-red-600 dark:text-red-400">
                  <FaTrashAlt className="text-xs" /> Delete Folder
                </button>
                <button onClick={() => setFolderMenuOpen(null)} className="mt-2 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-20 md:pb-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <FaTasks className="text-3xl md:text-4xl mb-2 opacity-30" />
            <p className="text-xs md:text-sm">No tasks {selectedFolderId ? 'in this folder' : 'yet'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {tasks.map(task => (
              <TaskCard
                key={task._id}
                task={task}
                onClick={() => onTaskClick(task._id)}
                brandColor={brandColor}
                isActive={selectedTaskId === task._id}
                draggable={canReorderTasks && !task.isArchived}
                onDragStart={onTaskDragStart}
                onDragEnd={onTaskDragEnd}
                onDragOver={onTaskDragOver}
                onDragLeave={onTaskDragLeave}
                onDrop={onTaskDrop}
                dragOver={dragOverTaskId === task._id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default YourWorkspaceProjectTasks;