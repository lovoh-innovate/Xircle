// src/components/YourWorkspaceProjectTeam.jsx
import React from 'react';
import { FaCrown, FaUsers, FaUserMinus } from 'react-icons/fa';

const YourWorkspaceProjectTeam = ({
  projectManagers,
  teamMembers,
  canManage,
  isTrash,
  isArchivedForMe,
  onAddManager,
  onRemoveManager,
  onAddMember,
  onRemoveMember,
  brandColor,
}) => {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
      {/* Managers */}
      <div className="py-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
            <FaCrown className="text-yellow-500 dark:text-yellow-400" /> Managers
          </span>
          {canManage && !isTrash && !isArchivedForMe && (
            <button onClick={onAddManager} className="text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition font-medium">
              Add
            </button>
          )}
        </div>
        {projectManagers.map(m => (
          <div key={m._id} className="flex items-center gap-3 py-2 group">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
              {m.profile ? <img src={m.profile} className="w-full h-full rounded-full object-cover" /> : m.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-[200px]">{m.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{m.email}</p>
            </div>
            {canManage && projectManagers.length > 1 && !isTrash && !isArchivedForMe && (
              <button onClick={() => onRemoveManager(m._id)} className="p-1 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition">
                <FaUserMinus className="text-sm" />
              </button>
            )}
          </div>
        ))}
      </div>
      {/* Team Members */}
      <div className="py-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
            <FaUsers className="text-teal-600 dark:text-[#0d9488]" /> Team ({teamMembers.length})
          </span>
          {canManage && !isTrash && !isArchivedForMe && (
            <button onClick={onAddMember} className="text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition font-medium">
              Add
            </button>
          )}
        </div>
        {teamMembers.map(m => {
          const user = m.user || m;
          const memberId = user._id;
          return (
            <div key={memberId} className="flex items-center gap-3 py-2 group">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brandColor }}>
                {user.profile ? <img src={user.profile} className="w-full h-full rounded-full object-cover" /> : user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px] md:max-w-[200px]">{user.name || 'Unknown'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{user.email}</p>
              </div>
              {canManage && !isTrash && !isArchivedForMe && (
                <button onClick={() => onRemoveMember(memberId)} className="p-1 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition">
                  <FaUserMinus className="text-sm" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default YourWorkspaceProjectTeam;