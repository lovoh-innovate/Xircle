// src/workspaceScreens/YourWorkspaceMembers.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetPendingRequestsQuery,
  useApproveMemberMutation,
  useRejectMemberMutation,
  useUpdateMemberMutation,
  useRemoveMemberMutation,
  useConvertAssociateToMemberMutation,
} from '../slices/teamApiSlice';
import { useCreateDirectChatMutation } from '../slices/messagingApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import {
  FaUsers,
  FaUserPlus,
  FaUserCheck,
  FaUserCog,
  FaTrashAlt,
  FaCheck,
  FaTimes,
  FaEdit,
  FaSearch,
  FaArrowLeft,
  FaEllipsisV,
  FaChevronDown,
  FaComment,
  FaUserShield,
  FaArrowUp,
  FaClock,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import useWorkspacePresence from '../services/useWorkspacePresence';

// ─── Global styles: skeleton shimmer ───────────────────────────────
const GlobalStyles = () => (
  <style>{`
    .skeleton {
      position: relative;
      overflow: hidden;
      background-color: rgb(229 231 235);
    }
    .dark .skeleton {
      background-color: rgba(255, 255, 255, 0.07);
    }
    .skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.55),
        transparent
      );
      animation: skeletonShimmer 1.5s ease-in-out infinite;
    }
    .dark .skeleton::after {
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.07),
        transparent
      );
    }
    @keyframes skeletonShimmer {
      100% { transform: translateX(100%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton::after { animation: none; }
    }
  `}</style>
);

// ─── Skeleton primitives ───────────────────────────────────────────
const Skeleton = ({ className = '', style }) => (
  <div className={`skeleton rounded-lg ${className}`} style={style} />
);

const MemberRowSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/30 last:border-0">
    <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-28 max-w-[50%]" />
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <Skeleton className="h-2.5 w-40 max-w-[70%]" />
    </div>
    <Skeleton className="w-6 h-6 rounded-lg flex-shrink-0" />
  </div>
);

const MembersLoadingShell = () => (
  <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
    <div className="hidden lg:block lg:w-64 lg:h-full flex-shrink-0">
      <YourWorkspaceSidebar />
    </div>

    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
        <div className="flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14">
          <div className="flex items-center gap-2 min-w-0">
            <Skeleton className="w-7 h-7 rounded-lg lg:hidden" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
        <div className="flex gap-4 px-3 sm:px-4 border-t border-gray-200/60 dark:border-gray-800/30">
          <Skeleton className="h-4 w-16 my-2" />
          <Skeleton className="h-4 w-16 my-2" />
          <Skeleton className="h-4 w-20 my-2" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
        {Array.from({ length: 8 }).map((_, i) => (
          <MemberRowSkeleton key={i} />
        ))}
      </div>
    </div>

    <YourWorkspaceBottombar />
  </div>
);

// ─── useMediaQuery hook ──────────────────────────────────────────────
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query, matches]);

  return matches;
};

// ─── Helpers ─────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

const getUserId = (u) => (u?._id ? u._id.toString() : u?.toString());

const isMemberAssociate = (m) => m?.memberType === 'associate';

const isMemberExpired = (m) => {
  if (!m?.accessExpiresAt) return false;
  return new Date(m.accessExpiresAt) < new Date();
};

const formatExpiry = (date) => {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
};

// ─── Custom Dropdown ─────────────────────────────────────────────────
const CustomDropdown = ({ options, value, onChange, placeholder, label, brandColor }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-600 transition"
      >
        <span className={selected ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder || 'Select...'}
        </span>
        <FaChevronDown className={`text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-300 dark:border-gray-700/60 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-lg">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 transition text-left text-gray-700 dark:text-gray-300 ${o.value === value ? 'bg-teal-50 dark:bg-[#0d9488]/10' : ''}`}
            >
              <span>{o.label}</span>
              {o.value === value && <FaCheck className="ml-auto text-xs" style={{ color: brandColor }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Confirm Modal ───────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onConfirm, onCancel, title, message, confirmLabel = 'Confirm', confirmColor = 'bg-red-600 hover:bg-red-700' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition ${confirmColor}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Member Action Bottom Sheet (mobile) ─────────────────────────────
const MemberActionSheet = ({
  isOpen,
  onClose,
  member,
  canManage,
  isOwner,
  onMakeAdmin,
  onRemoveAdmin,
  onRemoveMember,
  onDirectMessage,
  onEditRole,
  onPromoteAssociate,
  brandColor,
}) => {
  if (!isOpen || !member) return null;

  const user = member.user || {};
  const memberName = user.name || 'Unknown';
  const isSelf = getUserId(user) === String(member.currentUserId);
  const isWorkspaceOwner = getUserId(user) === String(member.workspaceOwnerId);
  const isTargetAssociate = isMemberAssociate(member);
  const isTargetExpired = isTargetAssociate && isMemberExpired(member);

  const showDirectMessage = !isSelf;
  const showRemoveMember = canManage && !isSelf && !isWorkspaceOwner;

  const showMakeAdmin =
    canManage && !isTargetAssociate && member.role !== 'Admin' && !isSelf && !isWorkspaceOwner;
  const showRemoveAdmin =
    canManage && !isTargetAssociate && member.role === 'Admin' && !isSelf && !isWorkspaceOwner && !isOwner;
  const showEditRole =
    canManage && !isTargetAssociate && !isSelf && !isWorkspaceOwner;

  const showPromoteAssociate =
    canManage && isTargetAssociate && !isSelf && !isWorkspaceOwner;

  const roleLabel = isTargetAssociate
    ? isTargetExpired
      ? 'Associate (expired)'
      : 'Associate'
    : member.role === 'Admin'
    ? 'Admin'
    : member.role || 'Member';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#14141a] rounded-t-2xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700/60">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium">
            {memberName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {memberName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</p>
          </div>
        </div>
        <div className="space-y-1">
          {showDirectMessage && (
            <button
              onClick={() => { onClose(); onDirectMessage(user._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
            >
              <FaComment className="text-sm" />
              <span className="text-sm font-medium">Direct Message</span>
            </button>
          )}

          {showEditRole && (
            <button
              onClick={() => { onClose(); onEditRole(member); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaEdit className="text-sm" />
              <span className="text-sm font-medium">Edit Role/Dept</span>
            </button>
          )}
          {showMakeAdmin && (
            <button
              onClick={() => { onClose(); onMakeAdmin(user._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaUserCog className="text-sm" />
              <span className="text-sm font-medium">Make Admin</span>
            </button>
          )}
          {showRemoveAdmin && (
            <button
              onClick={() => { onClose(); onRemoveAdmin(user._id); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition"
            >
              <FaUserCog className="text-sm" />
              <span className="text-sm font-medium">Remove Admin</span>
            </button>
          )}

          {showPromoteAssociate && (
            <button
              onClick={() => { onClose(); onPromoteAssociate(user._id, memberName); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
            >
              <FaArrowUp className="text-sm" />
              <span className="text-sm font-medium">Promote to Member</span>
            </button>
          )}

          {showRemoveMember && (
            <button
              onClick={() => { onClose(); onRemoveMember(user._id, memberName); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <FaTrashAlt className="text-sm" />
              <span className="text-sm font-medium">
                {isTargetAssociate ? 'Remove Associate' : 'Remove Member'}
              </span>
            </button>
          )}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Search Members Modal ─────────────────────────────────────────────
const SearchMembersModal = ({ isOpen, onClose, members, brandColor }) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = members.filter((member) => {
    const user = member.user || member;
    const name = user?.name?.toLowerCase() || '';
    const email = user?.email?.toLowerCase() || '';
    const q = query.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0b0b10] flex flex-col">
      <div className="flex items-center gap-2 px-3 h-14 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50/80 dark:bg-[#14141a]/80 backdrop-blur-sm flex-shrink-0">
        <button onClick={onClose} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft className="text-sm" />
        </button>
        <div className="flex-1 bg-gray-100 dark:bg-[#1e1e26] rounded-2xl px-3 py-1.5 flex items-center gap-2 border border-gray-200 dark:border-gray-800/40 focus-within:border-teal-500 dark:focus-within:border-[#0d9488]/50 transition">
          <FaSearch className="text-gray-400 dark:text-gray-500 text-xs" />
          <input
            type="text"
            placeholder="Search members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <FaSearch className="text-5xl mb-3 opacity-20" />
            <p className="text-sm">Search members by name or email</p>
          </div>
        )}
        {query && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">No members found for "{query}"</p>
          </div>
        )}
        {query && filtered.length > 0 && (
          <div className="space-y-1.5">
            {filtered.map((member) => {
              const user = member.user || member;
              const isAssoc = isMemberAssociate(member);
              return (
                <div
                  key={user._id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/40 hover:border-teal-500 dark:hover:border-[#0d9488]/40 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition cursor-pointer group"
                >
                  <div className="relative flex-shrink-0">
                    {user?.profile ? (
                      <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: brandColor }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                        {user?.name || 'Unknown'}
                      </p>
                      {isAssoc && (
                        <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          Associate
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{user?.email || 'No email'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Update Member Modal (permanent members only) ────────────────────
const UpdateMemberModal = ({ isOpen, onClose, member, brandColor, onSuccess }) => {
  const [role, setRole] = useState(member?.role || 'Staff');
  const [department, setDepartment] = useState(member?.department || 'General');
  const [isLoading, setIsLoading] = useState(false);
  const [updateMember] = useUpdateMemberMutation();

  const roleOptions = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Member', label: 'Member' },
    { value: 'Staff', label: 'Staff' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await updateMember({
        workspaceId: member?.workspaceId,
        memberId: getUserId(member?.user) || member?._id,
        role,
        department,
      }).unwrap();
      toast.success('Member updated!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update member');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FaUserCog className="text-sm text-teal-600 dark:text-[#0d9488]" /> Update Member
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <CustomDropdown
              label="Role"
              options={roleOptions}
              value={role}
              onChange={setRole}
              brandColor={brandColor}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Design"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-sm font-medium text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 text-white rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm font-medium"
              style={{ backgroundColor: brandColor }}
            >
              {isLoading ? 'Updating...' : 'Update Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Approve Member Modal ────────────────────────────────────────────
const ApproveMemberModal = ({ isOpen, onClose, memberId, workspaceId, brandColor, onSuccess }) => {
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('Member');
  const [isLoading, setIsLoading] = useState(false);
  const [approveMember] = useApproveMemberMutation();

  const roleOptions = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Member', label: 'Member' },
    { value: 'Staff', label: 'Staff' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!department.trim()) {
      toast.error('Department is required');
      return;
    }
    try {
      setIsLoading(true);
      await approveMember({
        workspaceId,
        memberId,
        department: department.trim(),
        role,
      }).unwrap();
      toast.success('Member approved!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to approve member');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FaUserCheck className="text-sm text-teal-600 dark:text-[#0d9488]" /> Approve Member
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Department *</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Design"
              className="w-full px-4 py-2 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500"
              required
            />
          </div>
          <div className="mb-4">
            <CustomDropdown
              label="Role"
              options={roleOptions}
              value={role}
              onChange={setRole}
              brandColor={brandColor}
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-sm font-medium text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 text-white rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm font-medium"
              style={{ backgroundColor: brandColor }}
            >
              {isLoading ? 'Approving...' : 'Approve Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// MemberItem
// ═════════════════════════════════════════════════════════════════════
const MemberItem = React.memo(({
  member,
  isPending,
  user,
  memberId,
  isWorkspaceOwner,
  isCurrentUser,
  canAct,
  brandColor,
  workspaceId,
  userInfo,
  isOwner,
  isAdmin,
  canManagePending,
  onApproveClick,
  onReject,
  onMakeAdmin,
  onRemoveAdmin,
  onRemoveMember,
  onDirectMessage,
  onEditRole,
  onPromoteAssociate,
  isMobile,
  onMemberClick,
  isOnline,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isTargetAssociate = isMemberAssociate(member);
  const isTargetExpired = isTargetAssociate && isMemberExpired(member);
  const expiryLabel = formatExpiry(member.accessExpiresAt);

  const memberForAction = {
    ...member,
    user,
    currentUserId: userInfo?._id,
    workspaceOwnerId: workspaceId?.owner?._id,
    role: member.role,
  };

  const handleRowClick = (e) => {
    if (!isMobile) return;
    if (isPending || isCurrentUser) return;
    if (e.target.closest('button')) return;
    if (onMemberClick) {
      onMemberClick(memberForAction);
    }
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const showEditRole = canAct && !isTargetAssociate;
  const showMakeAdmin = canAct && !isTargetAssociate && member.role !== 'Admin';
  const showRemoveAdmin = canAct && !isTargetAssociate && member.role === 'Admin' && !isOwner;
  const showPromote = canAct && isTargetAssociate;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a24] transition-colors border-b border-gray-100 dark:border-gray-800/30 last:border-0 cursor-pointer md:cursor-default"
      onClick={handleRowClick}
    >
      <div className="relative flex-shrink-0">
        {user?.profile ? (
          <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: brandColor }}
          >
            {getInitials(user?.name)}
          </div>
        )}
        {!isPending && member.status === 'active' && (
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0f0f12] ${
              isOnline ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'
            }`}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1">
          <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">
            {user?.name || 'Unknown'}
            {isCurrentUser && ' (You)'}
          </p>
          <div className="flex flex-wrap gap-1">
            {isPending && (
              <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-700/40">
                Pending
              </span>
            )}
            {!isPending && isWorkspaceOwner && (
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/40">
                Owner
              </span>
            )}
            {!isPending && isTargetAssociate && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                  isTargetExpired
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/40'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/40'
                }`}
              >
                <FaUserShield className="text-[8px]" />
                {isTargetExpired ? 'Expired' : 'Associate'}
              </span>
            )}
            {!isPending && !isTargetAssociate && member.role && member.role !== 'Owner' && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-700/40">
                {member.role}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          <span className="truncate">{user?.email || 'No email'}</span>
          {!isTargetAssociate && member.department && (
            <span className="hidden sm:inline">· {member.department}</span>
          )}
          {isTargetAssociate && expiryLabel && (
            <span className="hidden sm:inline-flex items-center gap-1">
              · <FaClock className="text-[9px]" /> Expires {expiryLabel}
            </span>
          )}
        </div>
      </div>

      {!isPending && canAct && (
        <div className="relative flex-shrink-0 hidden md:block" ref={menuRef}>
          <button
            onClick={toggleMenu}
            className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition"
          >
            <FaEllipsisV className="text-xs" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white dark:bg-[#1e1e26] rounded-xl shadow-lg border border-gray-200 dark:border-gray-800/60 min-w-[200px] z-10 py-1.5">
              {showEditRole && (
                <button
                  onClick={() => {
                    onEditRole({ ...member, user, workspaceId: workspaceId?._id });
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-[#0d9488]/10 hover:text-gray-900 dark:hover:text-white transition w-full"
                >
                  <FaEdit className="text-xs text-teal-600 dark:text-[#0d9488]" /> Edit Role/Dept
                </button>
              )}
              <button
                onClick={() => { onDirectMessage(user._id); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition w-full"
              >
                <FaComment className="text-xs" /> Direct Message
              </button>
              {showMakeAdmin && (
                <button
                  onClick={() => { onMakeAdmin(user._id); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition w-full"
                >
                  <FaUserCog className="text-xs" /> Make Admin
                </button>
              )}
              {showRemoveAdmin && (
                <button
                  onClick={() => { onRemoveAdmin(user._id); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition w-full"
                >
                  <FaUserCog className="text-xs" /> Remove Admin
                </button>
              )}
              {showPromote && (
                <button
                  onClick={() => { onPromoteAssociate(user._id, user?.name); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition w-full"
                >
                  <FaArrowUp className="text-xs" /> Promote to Member
                </button>
              )}
              <button
                onClick={() => { onRemoveMember(user._id, user?.name); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 transition w-full"
              >
                <FaTrashAlt className="text-xs" />
                {isTargetAssociate ? 'Remove Associate' : 'Remove'}
              </button>
            </div>
          )}
        </div>
      )}

      {!isPending && !isCurrentUser && (
        <div className="md:hidden flex-shrink-0 text-gray-400 dark:text-gray-500">
          <FaChevronDown className="text-xs" />
        </div>
      )}

      {isPending && canManagePending && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onApproveClick(user._id)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white rounded-full hover:opacity-80 transition"
            style={{ backgroundColor: brandColor }}
          >
            <FaCheck className="text-[9px]" /> <span className="hidden xs:inline">Approve</span>
          </button>
          <button
            onClick={() => onReject(user._id)}
            className="p-1.5 text-gray-400 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full transition"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Main Component ──────────────────────────────────────────────────
const YourWorkspaceMembers = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const isMobile = useMediaQuery('(max-width: 768px)');

  const onlineUserIds = useWorkspacePresence(workspaceId);

  const [activeTab, setActiveTab] = useState('active');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveMemberId, setApproveMemberId] = useState(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmLabel: 'Confirm',
  });

  // ─── Fetch workspace ─────────────────────────────────────────────
  const {
    data,
    isLoading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useGetWorkspaceQuery(workspaceId, {
    pollingInterval: 5000,
  });
  const workspace = data?.workspace;

  // ─── Permissions ─────────────────────────────────────────────────
  const isOwner = getUserId(workspace?.owner) === String(userInfo?._id);
  const currentUserMembership = workspace?.members?.find(
    (m) => getUserId(m.user) === String(userInfo?._id)
  );
  const isAssociate = currentUserMembership?.memberType === 'associate';
  const isAdmin = !isAssociate && currentUserMembership?.role === 'Admin';
  const canManagePending = isOwner || isAdmin;

  // ─── Pending requests ────────────────────────────────────────────
  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetPendingRequestsQuery(workspaceId, {
    pollingInterval: 3000,
    skip: !canManagePending,
  });

  // ─── Mutations ─────────────────────────────────────────────────────
  const [rejectMember] = useRejectMemberMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [updateMember] = useUpdateMemberMutation();
  const [promoteAssociate] = useConvertAssociateToMemberMutation();
  const [createDirectChat] = useCreateDirectChatMutation();

  // ─── Redirect on error ────────────────────────────────────────────
  if (workspaceError) {
    navigate(`/workspace/${workspaceId}`);
    return null;
  }

  // ─── Data extraction ──────────────────────────────────────────────
  const allActiveMembers = workspace?.members?.filter((m) => m.status === 'active') || [];

  // Permanent members (Owner + Admins + Members/Staff) — sorted by hierarchy
  const permanentMembers = allActiveMembers
    .filter((m) => !isMemberAssociate(m))
    .sort((a, b) => {
      const weight = (m) =>
        m.role === 'Owner' ? 0 : m.role === 'Admin' ? 1 : 2;
      const wa = weight(a);
      const wb = weight(b);
      if (wa !== wb) return wa - wb;
      return (a.user?.name || '')
        .toLowerCase()
        .localeCompare((b.user?.name || '').toLowerCase());
    });

  // Associates — active first, then expired, both alphabetical
  const associateMembers = allActiveMembers
    .filter(isMemberAssociate)
    .sort((a, b) => {
      const ea = isMemberExpired(a) ? 1 : 0;
      const eb = isMemberExpired(b) ? 1 : 0;
      if (ea !== eb) return ea - eb;
      return (a.user?.name || '')
        .toLowerCase()
        .localeCompare((b.user?.name || '').toLowerCase());
    });

  const pendingRequests = pendingData?.pending || [];
  const brandColor = workspace?.color || '#0d9488';

  // Count shown in the header badge — reflects the currently-active tab
  const currentTabCount =
    activeTab === 'active'
      ? permanentMembers.length
      : activeTab === 'pending'
      ? pendingRequests.length
      : associateMembers.length;

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleReject = async (memberId) => {
    if (!canManagePending) return toast.error('Only the owner or admin can reject requests.');
    setConfirmModal({
      isOpen: true,
      title: 'Reject Join Request',
      message: 'Are you sure you want to reject this join request?',
      confirmLabel: 'Reject',
      onConfirm: async () => {
        try {
          await rejectMember({ workspaceId, memberId }).unwrap();
          toast.success('Request rejected');
          refetchPending();
          refetchWorkspace();
          setConfirmModal({ isOpen: false });
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to reject');
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!isOwner && !isAdmin) return toast.error('You do not have permission to remove members.');

    const target = allActiveMembers.find((m) => getUserId(m.user) === memberId);
    const targetIsAssociate = isMemberAssociate(target);

    setConfirmModal({
      isOpen: true,
      title: targetIsAssociate ? 'Remove Associate' : 'Remove Member',
      message: targetIsAssociate
        ? `Remove ${memberName || 'this associate'}? They will lose access to all projects in this workspace.`
        : `Are you sure you want to remove ${memberName || 'this member'}?`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        try {
          await removeMember({ workspaceId, memberId }).unwrap();
          toast.success(targetIsAssociate ? 'Associate removed' : 'Member removed');
          refetchPending();
          refetchWorkspace();
          setConfirmModal({ isOpen: false });
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to remove');
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  const handleApproveClick = (memberId) => {
    if (!canManagePending) return toast.error('Only the owner or admin can approve requests.');
    setApproveMemberId(memberId);
    setShowApproveModal(true);
  };

  const handleApproveSuccess = () => {
    refetchPending();
    refetchWorkspace();
    setShowApproveModal(false);
    setApproveMemberId(null);
  };

  const handleDirectMessage = async (userId) => {
    if (!userId) return;
    try {
      const result = await createDirectChat({ workspaceId, targetUserId: userId }).unwrap();
      navigate(`/workspace/${workspaceId}/chat/${result.chat._id}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to start direct chat');
    }
  };

  const handleMakeAdmin = async (userId) => {
    const target = allActiveMembers.find((m) => getUserId(m.user) === userId);
    if (isMemberAssociate(target)) {
      toast.error('Associates cannot be made admins. Promote them to a permanent member first.');
      return;
    }
    try {
      await updateMember({
        workspaceId,
        memberId: userId,
        role: 'Admin',
        department: target?.department || 'General',
      }).unwrap();
      toast.success('Member promoted to Admin');
      refetchPending();
      refetchWorkspace();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to make admin');
    }
  };

  const handleRemoveAdmin = async (userId) => {
    const target = allActiveMembers.find((m) => getUserId(m.user) === userId);
    try {
      await updateMember({
        workspaceId,
        memberId: userId,
        role: 'Member',
        department: target?.department || 'General',
      }).unwrap();
      toast.success('Admin rights removed');
      refetchPending();
      refetchWorkspace();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to remove admin');
    }
  };

  const handleEditRole = (member) => {
    setSelectedMember({ ...member, workspaceId });
    setShowUpdateModal(true);
  };

  const handlePromoteAssociate = (memberId, memberName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Promote Associate',
      message: `Promote ${memberName || 'this associate'} to a permanent member? They will be added to the General department as Staff, and you can update their role and department afterwards.`,
      confirmLabel: 'Promote',
      confirmColor: 'bg-teal-600 hover:bg-teal-700',
      onConfirm: async () => {
        try {
          await promoteAssociate({
            workspaceId,
            memberId,
            role: 'Staff',
            department: 'General',
          }).unwrap();
          toast.success('Associate promoted to permanent member');
          refetchWorkspace();
          setConfirmModal({ isOpen: false });
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to promote associate');
          setConfirmModal({ isOpen: false });
        }
      },
    });
  };

  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setActionSheetOpen(true);
  };

  // ─── Loading state ────────────────────────────────────────────────
  if (workspaceLoading || pendingLoading) {
    return (
      <>
        <GlobalStyles />
        <MembersLoadingShell />
      </>
    );
  }

  // ─── Render member list ───────────────────────────────────────────
  const renderMemberList = (list, type = 'active') => {
    if (list.length === 0) {
      const emptyMessage =
        type === 'active'
          ? 'No active members found.'
          : type === 'associates'
          ? 'No associates on this workspace yet.'
          : 'No pending join requests.';

      const EmptyIcon = type === 'associates' ? FaUserShield : FaUsers;

      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <EmptyIcon className="text-4xl mb-2 opacity-30" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    return list.map((item) => {
      const user = item.user || item;
      const member = item;
      const isPending = type === 'pending';
      const memberId = getUserId(user) || item._id;
      const isWorkspaceOwner = getUserId(user) === getUserId(workspace?.owner);
      const isCurrentUser = getUserId(user) === String(userInfo?._id);

      const isOnline = onlineUserIds.has(memberId);
      const canAct = (isOwner || isAdmin) && !isCurrentUser && !isWorkspaceOwner;

      return (
        <MemberItem
          key={memberId}
          member={member}
          isPending={isPending}
          user={user}
          memberId={memberId}
          isWorkspaceOwner={isWorkspaceOwner}
          isCurrentUser={isCurrentUser}
          canAct={canAct}
          brandColor={brandColor}
          workspaceId={workspace}
          userInfo={userInfo}
          isOwner={isOwner}
          isAdmin={isAdmin}
          canManagePending={canManagePending}
          onApproveClick={handleApproveClick}
          onReject={handleReject}
          onMakeAdmin={handleMakeAdmin}
          onRemoveAdmin={handleRemoveAdmin}
          onRemoveMember={handleRemoveMember}
          onDirectMessage={handleDirectMessage}
          onEditRole={handleEditRole}
          onPromoteAssociate={handlePromoteAssociate}
          isMobile={isMobile}
          onMemberClick={handleMemberClick}
          isOnline={isOnline}
        />
      );
    });
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <>
      <GlobalStyles />

      <div className="h-dvh bg-gray-50 dark:bg-[#0b0b10] flex flex-col lg:flex-row overflow-hidden">
        <SearchMembersModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          members={allActiveMembers}
          brandColor={brandColor}
        />

        <div className="hidden md:block md:min-h-screen fixed top-0 left-0 z-20 workspace-shell-sidebar">
          <YourWorkspaceSidebar workspace={workspace} chats={[]} />
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden workspace-shell-main">
          <header className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 flex-shrink-0">
            <div className="flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => navigate(`/workspace/${workspaceId}`)}
                  className="p-1.5 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                >
                  <FaArrowLeft className="text-sm" />
                </button>
                <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
                  Members
                </h1>
                <span className="text-xs font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-[#1a1a24] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-800/40 flex-shrink-0">
                  {currentTabCount}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-xl transition"
                >
                  <FaSearch className="text-sm" />
                </button>
                {canManagePending && pendingRequests.length > 0 && (
                  <button
                    onClick={() => setActiveTab('pending')}
                    className="text-xs text-white font-medium px-2 py-1 rounded-full flex items-center gap-1"
                    style={{ backgroundColor: brandColor }}
                  >
                    <FaUserPlus className="text-[10px]" /> {pendingRequests.length}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-4 px-3 sm:px-4 border-t border-gray-200/60 dark:border-gray-800/30 overflow-x-auto">
              <button
                onClick={() => setActiveTab('active')}
                className={`pb-2 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  activeTab === 'active'
                    ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Active ({permanentMembers.length})
              </button>

              {canManagePending && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`pb-2 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                    activeTab === 'pending'
                      ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Pending ({pendingRequests.length})
                </button>
              )}

              <button
                onClick={() => setActiveTab('associates')}
                className={`pb-2 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  activeTab === 'associates'
                    ? 'border-b-2 border-teal-600 dark:border-[#0d9488] text-teal-600 dark:text-[#0d9488]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Associates ({associateMembers.length})
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f12] divide-y divide-gray-100 dark:divide-gray-800/30">
            {activeTab === 'active' && renderMemberList(permanentMembers, 'active')}
            {activeTab === 'pending' &&
              canManagePending &&
              renderMemberList(pendingRequests, 'pending')}
            {activeTab === 'associates' && renderMemberList(associateMembers, 'associates')}
          </div>
        </div>

        <YourWorkspaceBottombar workspace={workspace} />

        <MemberActionSheet
          isOpen={actionSheetOpen}
          onClose={() => {
            setActionSheetOpen(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          canManage={isOwner || isAdmin}
          isOwner={isOwner}
          isAdmin={isAdmin}
          onMakeAdmin={handleMakeAdmin}
          onRemoveAdmin={handleRemoveAdmin}
          onRemoveMember={handleRemoveMember}
          onDirectMessage={handleDirectMessage}
          onEditRole={handleEditRole}
          onPromoteAssociate={handlePromoteAssociate}
          brandColor={brandColor}
        />

        <UpdateMemberModal
          isOpen={showUpdateModal}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          brandColor={brandColor}
          onSuccess={() => {
            setShowUpdateModal(false);
            setSelectedMember(null);
            refetchWorkspace();
          }}
        />

        <ApproveMemberModal
          isOpen={showApproveModal}
          onClose={() => {
            setShowApproveModal(false);
            setApproveMemberId(null);
          }}
          memberId={approveMemberId}
          workspaceId={workspaceId}
          brandColor={brandColor}
          onSuccess={handleApproveSuccess}
        />

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onConfirm={confirmModal.onConfirm || (() => {})}
          onCancel={() => setConfirmModal({ isOpen: false })}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel || 'Confirm'}
          confirmColor={confirmModal.confirmColor || 'bg-red-600 hover:bg-red-700'}
        />
      </div>
    </>
  );
};

export default YourWorkspaceMembers;