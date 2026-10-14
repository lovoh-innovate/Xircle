// pages/Notes.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetNotesQuery,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useTogglePublicMutation,
  useMoveNoteMutation,
  useGetNoteFoldersQuery,
  useCreateNoteFolderMutation,
  useUpdateNoteFolderMutation,
  useDeleteNoteFolderMutation,
} from '../slices/personalNoteApiSlice';
import toast from 'react-hot-toast';
import {
  FaPlus,
  FaSpinner,
  FaFileAlt,
  FaTrashAlt,
  FaUnlock,
  FaLock,
  FaEllipsisV,
  FaUserPlus,
  FaFile,
  FaTimes,
  FaShareAlt,
  FaFolder,
  FaFolderOpen,
  FaFolderPlus,
  FaPen,
  FaChevronRight,
  FaChevronDown,
  FaInbox,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Share URL base ──────────────────────────────────────────────────
// Always built from the production web host — inside the Capacitor shell
// `window.location.origin` resolves to capacitor://localhost which would
// break links for recipients.
const SHARE_BASE_URL = 'https://xircle.lovohcreate.com';

// ─── Folder-tree helpers ─────────────────────────────────────────────

// Turn the flat folders array from the API into a nested tree.
// Orphans (parent points to a missing doc) are treated as roots.
const buildFolderTree = (folders) => {
  const byId = new Map();
  folders.forEach((f) => byId.set(f._id, { ...f, children: [] }));
  const roots = [];
  byId.forEach((f) => {
    if (f.parent && byId.has(f.parent)) byId.get(f.parent).children.push(f);
    else roots.push(f);
  });
  const sortFn = (a, b) => (a.order - b.order) || a.name.localeCompare(b.name);
  const sortRec = (arr) => {
    arr.sort(sortFn);
    arr.forEach((f) => sortRec(f.children));
  };
  sortRec(roots);
  return roots;
};

// Depth-first flatten for pickers.
const flattenTree = (nodes, depth = 0) => {
  const out = [];
  nodes.forEach((n) => {
    out.push({ ...n, depth });
    out.push(...flattenTree(n.children || [], depth + 1));
  });
  return out;
};

// Find a folder by id in a nested tree.
const findInTree = (nodes, id) => {
  for (const n of nodes) {
    if (n._id === id) return n;
    const hit = findInTree(n.children, id);
    if (hit) return hit;
  }
  return null;
};

// ═════════════════════════════════════════════════════════════════════
//  Confirm Modal
// ═════════════════════════════════════════════════════════════════════
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete' }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <FaTimes />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Prompt Modal (create / rename folder)
// ═════════════════════════════════════════════════════════════════════
const PromptModal = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = 'Folder name',
  initialValue = '',
  submitLabel = 'Save',
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Focus after paint
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;
  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-sm w-full p-5 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={placeholder}
          maxLength={100}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f12] text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
        />
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="flex-1 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Move Note → Folder Modal
// ═════════════════════════════════════════════════════════════════════
const MoveNoteModal = ({ isOpen, onClose, note, tree, onMove }) => {
  const flat = useMemo(() => flattenTree(tree), [tree]);
  if (!isOpen || !note) return null;

  const current = note.folder || null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl max-w-sm w-full max-h-[70vh] shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">Move to folder</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {/* Unfiled / root */}
          <button
            onClick={() => onMove(note._id, null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
              current === null
                ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <FaInbox className="text-xs text-gray-400" />
            <span className="truncate">No folder (root)</span>
          </button>

          {flat.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              You haven't created any folders yet.
            </p>
          )}

          {flat.map((f) => {
            const isCurrent = current === f._id;
            return (
              <button
                key={f._id}
                onClick={() => onMove(note._id, f._id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  isCurrent
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={{ paddingLeft: 12 + f.depth * 14 }}
              >
                <FaFolder className="text-xs text-gray-400 flex-shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Folder Tree (recursive)
// ═════════════════════════════════════════════════════════════════════
const FolderNode = ({
  folder,
  depth,
  selectedId,
  onSelect,
  onContextMenu,
  expandedIds,
  toggleExpand,
}) => {
  const hasChildren = folder.children?.length > 0;
  const isExpanded = expandedIds.has(folder._id);
  const isSelected = selectedId === folder._id;

  return (
    <>
      <div
        className={`group flex items-center gap-1 rounded-lg cursor-pointer select-none ${
          isSelected
            ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{ paddingLeft: 4 + depth * 12, paddingRight: 4 }}
        onClick={() => onSelect(folder._id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleExpand(folder._id);
          }}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded ${
            hasChildren ? 'hover:bg-black/5 dark:hover:bg-white/5' : 'invisible'
          }`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <FaChevronDown className="text-[8px]" />
          ) : (
            <FaChevronRight className="text-[8px]" />
          )}
        </button>

        {isSelected || isExpanded ? (
          <FaFolderOpen className="text-teal-500 text-xs flex-shrink-0" />
        ) : (
          <FaFolder className="text-gray-400 text-xs flex-shrink-0" />
        )}

        <span className="text-xs truncate flex-1 py-1.5">{folder.name}</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, folder);
          }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded transition flex-shrink-0"
          aria-label="Folder options"
        >
          <FaEllipsisV className="text-[10px]" />
        </button>
      </div>

      {hasChildren && isExpanded && (
        <>
          {folder.children.map((c) => (
            <FolderNode
              key={c._id}
              folder={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))}
        </>
      )}
    </>
  );
};

// Small context menu shown when clicking ⋯ on a folder.
const FolderContextMenu = ({ pos, onClose, onRename, onDelete, onNewSubfolder }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => e.key === 'Escape' && onClose();
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  if (!pos) return null;

  const style = {
    position: 'fixed',
    left: Math.min(pos.x, Math.max(0, window.innerWidth - 200)),
    top: Math.min(pos.y, Math.max(0, window.innerHeight - 160)),
    width: 190,
    zIndex: 200,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1"
    >
      <button
        onClick={() => { onNewSubfolder(); onClose(); }}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
      >
        <FaFolderPlus className="text-xs text-teal-500" /> New subfolder
      </button>
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
      >
        <FaPen className="text-xs" /> Rename
      </button>
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
      >
        <FaTrashAlt className="text-xs" /> Delete
      </button>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Note Card
// ═════════════════════════════════════════════════════════════════════
const NoteCard = ({ note, onClick, onDelete, onTogglePublic, onShareLink, onMove }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowMenu(false);
        setMenuPos(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setMenuPos(null);
      }
    };
    const handleScroll = () => {
      setShowMenu(false);
      setMenuPos(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showMenu]);

  const toggleMenu = (e) => {
    e.stopPropagation();
    setMenuPos(null);
    setShowMenu((v) => !v);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const closeMenu = () => {
    setShowMenu(false);
    setMenuPos(null);
  };

  const formatDate = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const preview = stripHtml(note.content || '').slice(0, 120);

  const menuStyle = menuPos
    ? {
        position: 'fixed',
        left: Math.min(menuPos.x, Math.max(0, window.innerWidth - 220)),
        top: Math.min(menuPos.y, Math.max(0, window.innerHeight - 240)),
        width: 200,
        zIndex: 100,
      }
    : undefined;

  const menuClassName = menuPos
    ? 'bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1'
    : 'absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-20';

  return (
    <div
      className="bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition cursor-pointer"
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FaFileAlt className="text-teal-500 text-sm flex-shrink-0" />
            <h3 className="text-sm font-medium text-gray-800 dark:text-white truncate">
              {note.title}
            </h3>
            {note.isPublic && (
              <span className="flex-shrink-0 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                Public
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {preview || 'Empty note'}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
            <span>Updated {formatDate(note.updatedAt)}</span>
            {note.folder && (
              <span className="flex items-center gap-1">
                <FaFolder className="text-[10px]" /> {note.folder.name}
              </span>
            )}
            {note.attachments?.length > 0 && (
              <span className="flex items-center gap-1">
                <FaFile className="text-[10px]" /> {note.attachments.length}
              </span>
            )}
            {note.collaborators?.length > 0 && (
              <span className="flex items-center gap-1">
                <FaUserPlus className="text-[10px]" /> {note.collaborators.length}
              </span>
            )}
          </div>
        </div>

        <div
          ref={wrapperRef}
          className="flex-shrink-0 flex items-center gap-1 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={toggleMenu}
            className={`p-1.5 rounded-lg transition ${
              showMenu
                ? 'text-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'text-gray-400 hover:text-teal-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            aria-label="Note options"
          >
            <FaEllipsisV className="text-sm" />
          </button>

          {showMenu && (
            <div
              style={menuStyle}
              className={menuClassName}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Move to folder */}
              <button
                type="button"
                onClick={() => { onMove(note); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
              >
                <FaFolder className="text-xs text-teal-500" />
                Move to folder…
              </button>

              {note.isPublic && note.shareLink && (
                <button
                  type="button"
                  onClick={() => { onShareLink(note); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
                >
                  <FaShareAlt className="text-xs text-teal-500" />
                  Share link
                </button>
              )}

              <button
                type="button"
                onClick={() => { onTogglePublic(note._id, !note.isPublic); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
              >
                {note.isPublic ? <FaLock className="text-xs" /> : <FaUnlock className="text-xs" />}
                {note.isPublic ? 'Make Private' : 'Make Public'}
              </button>

              <button
                type="button"
                onClick={() => { onDelete(note); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
              >
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Main Component
// ═════════════════════════════════════════════════════════════════════
const Notes = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // selectedFolder: 'all' | 'root' | <folderId>
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);

  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const isCreatingRef = useRef(false);

  // Folder modals
  const [promptState, setPromptState] = useState(null);
  // { mode: 'create' | 'rename' | 'create-sub', folderId?, parentId?, initialValue? }

  // Folder context menu
  const [folderMenu, setFolderMenu] = useState(null);
  // { pos: {x, y}, folder }

  // ── Data ──────────────────────────────────────────────────────────
  const notesArg = selectedFolder === 'all' ? undefined : selectedFolder;
  const {
    data: notesData,
    isLoading,
  } = useGetNotesQuery(notesArg);

  const {
    data: foldersData,
    isLoading: foldersLoading,
  } = useGetNoteFoldersQuery();

  const [createNote] = useCreateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [togglePublic] = useTogglePublicMutation();
  const [moveNote] = useMoveNoteMutation();
  const [createFolder] = useCreateNoteFolderMutation();
  const [updateFolder] = useUpdateNoteFolderMutation();
  const [deleteFolder] = useDeleteNoteFolderMutation();

  const notes = notesData?.notes || [];
  const folders = foldersData?.folders || [];

  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  // Expand top-level folders by default when first loaded.
  useEffect(() => {
    if (folders.length > 0 && expandedIds.size === 0) {
      const roots = folders.filter((f) => !f.parent).map((f) => f._id);
      setExpandedIds(new Set(roots));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders.length]);

  // If the selected folder disappears (was deleted), reset.
  useEffect(() => {
    if (selectedFolder === 'all' || selectedFolder === 'root') return;
    const exists = folders.some((f) => f._id === selectedFolder);
    if (!exists && !foldersLoading) setSelectedFolder('all');
  }, [folders, foldersLoading, selectedFolder]);

  // ── Selection label ──────────────────────────────────────────────
  const currentFolderName = useMemo(() => {
    if (selectedFolder === 'all') return 'All Notes';
    if (selectedFolder === 'root') return 'Unfiled';
    const found = folders.find((f) => f._id === selectedFolder);
    return found?.name || 'All Notes';
  }, [selectedFolder, folders]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleDelete = (note) => setDeleteTarget(note);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNote(deleteTarget._id).unwrap();
      toast.success('Note deleted');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete note');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleTogglePublic = async (noteId, isPublic) => {
    try {
      await togglePublic({ noteId, isPublic }).unwrap();
      toast.success(isPublic ? 'Note is now public' : 'Note is now private');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update public status');
    }
  };

  const handleShareLink = useCallback(async (note) => {
    if (!note?.shareLink) {
      toast.error('No share link available');
      return;
    }
    const url = `${SHARE_BASE_URL}/share/${note.shareLink}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: note.title || 'Note', url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success('Share link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  }, []);

  const openNote = (noteId) => navigate(`/notes/${noteId}`);

  const handleCreateNote = async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreatingNote(true);
    try {
      // Create inside the currently-viewed folder if it's a real folder.
      const folderId =
        selectedFolder === 'all' || selectedFolder === 'root'
          ? null
          : selectedFolder;

      const result = await createNote({
        title: 'Untitled',
        content: '',
        folderId,
      }).unwrap();
      navigate(`/notes/${result.note._id}`, { state: { justCreated: true } });
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create note');
    } finally {
      isCreatingRef.current = false;
      setIsCreatingNote(false);
    }
  };

  // ── Folder CRUD ──────────────────────────────────────────────────

  const handleFolderMenuOpen = (e, folder) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFolderMenu({
      pos: { x: rect.right - 10, y: rect.bottom + 4 },
      folder,
    });
  };

  const handleFolderPromptSubmit = async (name) => {
    if (!promptState) return;
    try {
      if (promptState.mode === 'create' || promptState.mode === 'create-sub') {
        await createFolder({
          name,
          parentId: promptState.parentId || null,
        }).unwrap();
        // Auto-expand parent so the new child is visible
        if (promptState.parentId) {
          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.add(promptState.parentId);
            return next;
          });
        }
        toast.success('Folder created');
      } else if (promptState.mode === 'rename') {
        await updateFolder({
          folderId: promptState.folderId,
          data: { name },
        }).unwrap();
        toast.success('Folder renamed');
      }
      setPromptState(null);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to save folder');
    }
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      // Default backend behaviour: notes move to the folder's parent
      // (or root if it was top-level), sub-folders bubble up.
      await deleteFolder({ folderId: folderToDelete._id }).unwrap();
      toast.success('Folder deleted');
      if (selectedFolder === folderToDelete._id) setSelectedFolder('all');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete folder');
    } finally {
      setFolderToDelete(null);
    }
  };

  // ── Move Note ────────────────────────────────────────────────────

  const handleMove = async (noteId, folderId) => {
    try {
      await moveNote({ noteId, folderId }).unwrap();
      toast.success(folderId ? 'Note moved' : 'Note moved to root');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to move note');
    } finally {
      setMoveTarget(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // The shared FolderTree panel — reused on desktop and in the mobile drawer.
  const FolderTreePanel = () => (
    <div className="flex flex-col h-full">
      {/* Special rows: All Notes / Unfiled */}
      <div className="space-y-0.5 pb-2">
        <div
          onClick={() => { setSelectedFolder('all'); setFolderDrawerOpen(false); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer select-none ${
            selectedFolder === 'all'
              ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <FaFileAlt className="text-xs flex-shrink-0" />
          <span className="text-xs font-medium truncate">All Notes</span>
        </div>
        <div
          onClick={() => { setSelectedFolder('root'); setFolderDrawerOpen(false); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer select-none ${
            selectedFolder === 'root'
              ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <FaInbox className="text-xs flex-shrink-0" />
          <span className="text-xs font-medium truncate">Unfiled</span>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
        {foldersLoading ? (
          <div className="flex items-center justify-center py-4">
            <FaSpinner className="animate-spin text-teal-500 text-sm" />
          </div>
        ) : tree.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4 px-2">
            No folders yet. Create one to organize your notes.
          </p>
        ) : (
          <div className="space-y-0.5">
            {tree.map((f) => (
              <FolderNode
                key={f._id}
                folder={f}
                depth={0}
                selectedId={selectedFolder}
                onSelect={(id) => {
                  setSelectedFolder(id);
                  setFolderDrawerOpen(false);
                }}
                onContextMenu={handleFolderMenuOpen}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Loading screen ───────────────────────────────────────────────
  if (isLoading && selectedFolder === 'all') {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-dvh bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row overflow-hidden">
        {/* Nav sidebar (desktop) */}
        <div className="hidden md:block md:w-72 md:flex-shrink-0">
          <GeneralSidebar />
        </div>

        {/* Folder sidebar (desktop) */}
        <aside className="hidden md:flex md:w-60 md:flex-shrink-0 border-r border-gray-100 dark:border-gray-800 flex-col bg-gray-50/60 dark:bg-[#141418]">
          <header className="h-12 px-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Folders
            </h2>
            <button
              onClick={() => setPromptState({ mode: 'create', parentId: null })}
              className="p-1.5 rounded-lg text-gray-400 hover:text-teal-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="New folder"
              aria-label="New folder"
            >
              <FaFolderPlus className="text-sm" />
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            <FolderTreePanel />
          </div>
        </aside>

        {/* Notes list column */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 flex-shrink-0">
            <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
              {/* Mobile: folder drawer trigger */}
              <button
                onClick={() => setFolderDrawerOpen(true)}
                className="md:hidden p-1.5 -ml-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Open folders"
              >
                <FaFolderOpen className="text-sm" />
              </button>

              <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2 flex-1 min-w-0">
                <FaFolder className="text-teal-500 text-sm hidden sm:block flex-shrink-0" />
                <span className="truncate">{currentFolderName}</span>
              </h1>

              <button
                onClick={handleCreateNote}
                disabled={isCreatingNote}
                className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="New note"
              >
                {isCreatingNote ? (
                  <FaSpinner className="text-sm animate-spin" />
                ) : (
                  <FaPlus className="text-sm" />
                )}
              </button>
            </div>
          </header>

          <main
            className="flex-1 min-h-0 overflow-y-auto"
            style={{
              paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
                <FaFileAlt className="text-4xl mb-2 opacity-30" />
                <p className="text-sm font-medium">
                  {selectedFolder === 'all'
                    ? 'No notes yet'
                    : `No notes in ${currentFolderName}`}
                </p>
                <p className="text-xs">Create your first note by tapping the + button.</p>
              </div>
            ) : (
              <div className="md:pb-6">
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    onClick={() => openNote(note._id)}
                    onDelete={handleDelete}
                    onTogglePublic={handleTogglePublic}
                    onShareLink={handleShareLink}
                    onMove={setMoveTarget}
                  />
                ))}
              </div>
            )}
          </main>

          <GeneralBottombar />
        </div>
      </div>

      {/* Floating action button */}
      <button
        onClick={handleCreateNote}
        disabled={isCreatingNote}
        className="fixed right-4 sm:right-6 z-30 w-12 h-12 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {isCreatingNote ? (
          <FaSpinner className="text-xl animate-spin" />
        ) : (
          <FaPlus className="text-xl" />
        )}
      </button>

      {/* Mobile folder drawer */}
      {folderDrawerOpen && (
        <div className="fixed inset-0 z-[55] md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setFolderDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-white dark:bg-[#1a1a1a] shadow-xl flex flex-col">
            <div className="h-12 px-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Folders</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPromptState({ mode: 'create', parentId: null });
                    setFolderDrawerOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-teal-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  aria-label="New folder"
                >
                  <FaFolderPlus className="text-sm" />
                </button>
                <button
                  onClick={() => setFolderDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  aria-label="Close"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              <FolderTreePanel />
            </div>
          </div>
        </div>
      )}

      {/* Folder context menu */}
      {folderMenu && (
        <FolderContextMenu
          pos={folderMenu.pos}
          onClose={() => setFolderMenu(null)}
          onRename={() =>
            setPromptState({
              mode: 'rename',
              folderId: folderMenu.folder._id,
              initialValue: folderMenu.folder.name,
            })
          }
          onNewSubfolder={() =>
            setPromptState({
              mode: 'create-sub',
              parentId: folderMenu.folder._id,
            })
          }
          onDelete={() => setFolderToDelete(folderMenu.folder)}
        />
      )}

      {/* Create / Rename folder prompt */}
      <PromptModal
        isOpen={!!promptState}
        onClose={() => setPromptState(null)}
        onSubmit={handleFolderPromptSubmit}
        title={
          promptState?.mode === 'rename'
            ? 'Rename folder'
            : promptState?.mode === 'create-sub'
            ? 'New subfolder'
            : 'New folder'
        }
        initialValue={promptState?.initialValue || ''}
        submitLabel={promptState?.mode === 'rename' ? 'Rename' : 'Create'}
      />

      {/* Move note modal */}
      <MoveNoteModal
        isOpen={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        note={moveTarget}
        tree={tree}
        onMove={handleMove}
      />

      {/* Delete confirmations */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Note"
        message="This note will be permanently deleted. This action cannot be undone."
      />

      <ConfirmModal
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={confirmDeleteFolder}
        title="Delete Folder"
        message={`"${folderToDelete?.name}" will be deleted. Notes inside will be moved to its parent folder, and any subfolders will be promoted one level up.`}
      />
    </>
  );
};

export default Notes;