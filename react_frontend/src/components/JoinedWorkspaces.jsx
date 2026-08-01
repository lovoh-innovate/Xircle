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

  return (
    <CardWrapper
      {...cardProps}
      className={`group flex items-center gap-3.5 px-4 py-3.5 transition-colors ${
        isClickable
          ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04] active:bg-gray-100 dark:active:bg-white/[0.06]'
          : 'opacity-60 cursor-default'
      }`}
    >
      {workspace.logo ? (
        <img
          src={workspace.logo}
          alt={workspace.name}
          className="w-11 h-11 rounded-2xl object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-700"
        />
      ) : (
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-semibold text-[15px] flex-shrink-0 shadow-sm"
          style={{ backgroundColor: workspace.color || '#0d9488' }}
        >
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[15px] text-gray-900 dark:text-white truncate leading-tight">
            {workspace.name}
          </span>
          {isPending && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 whitespace-nowrap">
              <FaClock className="text-[10px]" />
              Pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <FaUsers className="text-teal-500 dark:text-teal-400 text-xs shrink-0" />
            <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </span>
          {workspace.industry && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <FaIndustry className="text-teal-500 dark:text-teal-400 text-xs shrink-0" />
              <span className="truncate">{workspace.industry}</span>
            </span>
          )}
        </div>
      </div>

      {isClickable && (
        <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 text-xs group-hover:text-gray-400 dark:group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
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
      <div className="p-4 text-center text-gray-400 dark:text-gray-500">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-2 text-sm">Loading...</p>
      </div>
    );
  }

  if (joinedWorkspaces.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 dark:text-gray-500">
        <FaUsers className="text-3xl mx-auto opacity-30" />
        <p className="mt-2 text-sm">No joined workspaces yet.</p>
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