// src/workspaceComponents/MyWorkspaceProjectTasks.jsx
import React, { useState, useRef } from 'react';
import { FaFolder, FaPlus, FaPen, FaTimes, FaLockOpen, FaArchive, FaTasks, FaTrashAlt } from 'react-icons/fa';
import { TaskCard } from './ProjectHelpers';

const MyWorkspaceProjectTasks = ({
  tasks,
  folders,
  activeFolderId,
  showArchived,
  onFolderSelect,
  onTaskClick,
  selectedTaskId,
  brandColor,
  canManage,
  isFolderReadOnly,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onManageFolderAccess,
  onToggleArchived,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDragOver,
  onTaskDragLeave,
  onTaskDrop,
  dragOverTaskId,
  canReorderTasks,
  onCopyClick,
  onMoveClick,
  onDragOverFolder,
  onDropOnFolder,
  draggedOverTabId,
  isDraggingSomething,
  onDragLeaveFolder,
}) => {
  const [folderMenuOpen, setFolderMenuOpen] = useState(null);
  const longPressTimer = useRef(null);

  const handleTouchStart = (e, folderId) => {
    if (!canManage) return;
    longPressTimer.current = setTimeout(() => {
      setFolderMenuOpen(folderId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };
  const handleTouchEnd = () => { clearTimeout(longPressTimer.current); };
  const handleTouchMove = () => { clearTimeout(longPressTimer.current); };

  return (
    <div className="flex flex-col h-full">
      {/* Folder tabs bar */}
      <div className="flex items-center gap-1 px-3 md:px-4 border-b border-gray-200 dark:border-gray-800/30 overflow-x-auto scrollbar-hide py-1">
        <div
          onClick={() => { onFolderSelect(null); onToggleArchived(false); }}
          onDragOver={(e) => !showArchived && onDragOverFolder(e, null)}
          onDragLeave={onDragLeaveFolder}
          onDrop={(e) => !showArchived && onDropOnFolder(e, null)}
          className={`relative flex-shrink-0 cursor-pointer text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
            !showArchived && activeFolderId === null
              ? 'bg-[#0d9488]/10 text-[#0d9488]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          } ${!showArchived && draggedOverTabId === null && isDraggingSomething ? 'ring-2 ring-[#0d9488] ring-offset-2 bg-[#0d9488]/5' : ''}`}
        >
          All Tasks
          {!showArchived && draggedOverTabId === null && isDraggingSomething && (
            <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-medium text-[#0d9488] bg-white dark:bg-[#0f0f12] px-1.5 py-0.5 rounded shadow whitespace-nowrap">Move here?</span>
          )}
        </div>

        <div
          onClick={onToggleArchived}
          className={`flex-shrink-0 cursor-pointer text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
            showArchived
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <span className="flex items-center gap-1"><FaArchive className="text-[10px] md:text-xs" /> Archived</span>
        </div>

        {!showArchived && folders.map(folder => {
          const readOnly = isFolderReadOnly(folder._id);
          return (
            <div
              key={folder._id}
              className="relative flex-shrink-0 group"
              onDragOver={(e) => onDragOverFolder(e, folder._id)}
              onDragLeave={onDragLeaveFolder}
              onDrop={(e) => onDropOnFolder(e, folder._id)}
            >
              <div
                onClick={() => { onFolderSelect(folder._id); onToggleArchived(false); }}
                onTouchStart={(e) => handleTouchStart(e, folder._id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                className={`flex items-center gap-1 cursor-pointer text-xs md:text-sm font-medium transition px-2.5 md:px-3 py-1.5 rounded-xl whitespace-nowrap ${
                  !showArchived && activeFolderId === folder._id
                    ? 'bg-[#0d9488]/10 text-[#0d9488]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                } ${!showArchived && draggedOverTabId === folder._id && isDraggingSomething ? 'ring-2 ring-[#0d9488] ring-offset-2 bg-[#0d9488]/5' : ''}`}
              >
                <span className="truncate max-w-[80px] md:max-w-[120px]">{folder.name}</span>
                {readOnly && <FaLockOpen className="text-[10px] text-blue-400" />}
                {canManage && (
                  <span className="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 ml-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onRenameFolder(folder._id, folder.name); }} className="p-0.5 text-blue-400 hover:text-blue-600 transition rounded" title="Rename"><FaPen className="text-[10px]" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder._id); }} className="p-0.5 text-red-400 hover:text-red-600 transition rounded" title="Delete"><FaTimes className="text-[10px]" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onManageFolderAccess(folder); }} className="p-0.5 text-yellow-500 hover:text-yellow-600 transition rounded" title="Manage Access"><FaLockOpen className="text-[10px]" /></button>
                  </span>
                )}
                {!showArchived && draggedOverTabId === folder._id && isDraggingSomething && (
                  <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-medium text-[#0d9488] bg-white dark:bg-[#0f0f12] px-1.5 py-0.5 rounded shadow whitespace-nowrap">Move here?</span>
                )}
              </div>
            </div>
          );
        })}
        {canManage && !showArchived && (
          <button onClick={onCreateFolder} className="flex-shrink-0 p-1.5 text-[#0d9488] hover:bg-[#0d9488]/10 rounded-lg transition" title="Create new folder"><FaPlus className="text-sm" /></button>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-20 md:pb-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-500">
            <FaTasks className="text-3xl md:text-4xl mb-2 opacity-30" />
            <p className="text-xs md:text-sm">{showArchived ? 'No archived tasks' : 'No tasks in this view'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {tasks.map(task => {
              const folderId = task.folder?._id || task.folder;
              const readOnly = !canManage && folderId && isFolderReadOnly(folderId);
              const isDragOver = dragOverTaskId === task._id;
              return (
                <TaskCard
                  key={task._id}
                  task={task}
                  onClick={onTaskClick}
                  brandColor={brandColor}
                  isActive={selectedTaskId === task._id}
                  draggable={canReorderTasks && !readOnly && !showArchived}
                  onDragStart={onTaskDragStart}
                  onDragEnd={onTaskDragEnd}
                  onDragOver={onTaskDragOver}
                  onDragLeave={onTaskDragLeave}
                  onDrop={onTaskDrop}
                  onCopyClick={onCopyClick}
                  onMoveClick={onMoveClick}
                  readOnly={readOnly}
                  showArchived={showArchived}
                  dragOver={isDragOver}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile long-press menu */}
      {folderMenuOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4" onClick={() => setFolderMenuOpen(null)}>
          <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setFolderMenuOpen(null); const f = folders.find(f => f._id === folderMenuOpen); if (f) onRenameFolder(f._id, f.name); }} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"><FaPen className="text-blue-500" /> Rename Folder</button>
              <button onClick={() => { setFolderMenuOpen(null); const f = folders.find(f => f._id === folderMenuOpen); if (f) onManageFolderAccess(f); }} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1a1a24] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"><FaLockOpen className="text-yellow-500" /> Manage Access</button>
              <button onClick={() => { setFolderMenuOpen(null); onDeleteFolder(folderMenuOpen); }} className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-800/30 transition text-red-600 dark:text-red-400"><FaTrashAlt className="text-xs" /> Delete Folder</button>
              <button onClick={() => setFolderMenuOpen(null)} className="mt-2 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyWorkspaceProjectTasks;