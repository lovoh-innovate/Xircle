// components/JoinedWorkspaces.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetMyWorkspacesQuery } from '../slices/workspaceApiSlice';
import {
  FaUsers,
  FaIndustry,
  FaClock,
  FaChevronRight,
} from 'react-icons/fa';

const JoinedWorkspaceItem = ({ workspace, userInfo }) => {
  const memberCount = workspace.members?.length || 0;
  const initials =
    workspace.initials ||
    workspace.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const currentUserMembership = workspace.members?.find(
    (m) => m.user?._id === userInfo?._id || m.user === userInfo?._id
  );
  const membershipStatus = currentUserMembership?.status || 'active';
  const isPending = membershipStatus === 'pending';
  const isClickable = !isPending;

  const CardWrapper = isClickable ? Link : 'div';
  const cardProps = isClickable ? { to: `/workspace/${workspace._id}` } : {};

  const subtitle = [workspace.industry, `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <CardWrapper
      {...cardProps}
      className={`group flex items-center gap-3 px-3 sm:px-4 min-h-[60px] transition-colors ${
        isClickable
          ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04] active:bg-gray-100 dark:active:bg-white/[0.06]'
          : 'opacity-60 cursor-default'
      }`}
    >
      {workspace.logo ? (
        <img
          src={workspace.logo}
          alt={workspace.name}
          className="w-10 h-10 rounded-2xl object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-700"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm"
          style={{ backgroundColor: workspace.color || '#0d9488' }}
        >
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px] leading-tight">
            {workspace.name}
          </span>
          {isPending && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 whitespace-nowrap flex-shrink-0">
              <FaClock className="text-[10px]" />
              Pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          <span className="inline-flex items-center gap-1.5">
            <FaUsers className="text-teal-500 dark:text-teal-400 text-[10px] shrink-0" />
            <span className="truncate max-w-[60px] sm:max-w-full">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </span>
          {workspace.industry && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <FaIndustry className="text-teal-500 dark:text-teal-400 text-[10px] shrink-0" />
              <span className="truncate max-w-[80px] sm:max-w-full">{workspace.industry}</span>
            </span>
          )}
        </div>
      </div>

      {isClickable && (
        <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 text-[10px] group-hover:text-gray-400 dark:group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
      )}
    </CardWrapper>
  );
};

const JoinedWorkspaces = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { data, isLoading } = useGetMyWorkspacesQuery(undefined, {
    pollingInterval: 30000,
  });

  const joinedWorkspaces = data?.joinedBusinesses || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[120px] text-gray-400 dark:text-gray-500">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (joinedWorkspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[120px] text-gray-400 dark:text-gray-500">
        <FaUsers className="text-3xl mb-2 opacity-30" />
        <p className="text-sm">No joined workspaces.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
      {joinedWorkspaces.map((ws) => (
        <JoinedWorkspaceItem key={ws._id} workspace={ws} userInfo={userInfo} />
      ))}
    </div>
  );
};

export default JoinedWorkspaces;