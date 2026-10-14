// src/workspaceScreens/YourWorkspaceNotes.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import {
  useGetWorkspaceNotesQuery,
  useCreateWorkspaceNoteMutation,
  useDeleteWorkspaceNoteMutation,
  useMoveWorkspaceNoteMutation,
  useGetWorkspaceNoteFoldersQuery,
  useCreateWorkspaceNoteFolderMutation,
  useUpdateWorkspaceNoteFolderMutation,
  useDeleteWorkspaceNoteFolderMutation,
  useLazyExportWorkspaceNotePDFQuery,
} from '../slices/workspaceNoteApiSlice';
import YourWorkspaceSidebar from '../components/YourWorkspaceSidebar';
import YourWorkspaceBottombar from '../components/YourWorkspaceBottombar';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  FaPlus,
  FaSpinner,
  FaFileAlt,
  FaTrashAlt,
  FaEllipsisV,
  FaFolder,
  FaFolderOpen,
  FaFolderPlus,
  FaPen,
  FaChevronRight,
  FaChevronDown,
  FaInbox,
  FaArrowLeft,
  FaTimes,
  FaDownload,
} from 'react-icons/fa';

// ═════════════════════════════════════════════════════════════════════
//  Global styles
// ═════════════════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    .ws-notes-scroll::-webkit-scrollbar { width: 6px; }
    .ws-notes-scroll::-webkit-scrollbar-thumb {
      background: rgba(148,163,184,0.3); border-radius: 999px;
    }
    .ws-notes-scroll::-webkit-scrollbar-track { background: transparent; }

    .ws-mobile-header { padding-top: env(safe-area-inset-top, 0px); }
    .ws-mobile-header-spacer { height: calc(3rem + env(safe-area-inset-top, 0px)); }

    .line-clamp-2 {
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `}</style>
);

// ═════════════════════════════════════════════════════════════════════
//  Folder tree helpers
// ═════════════════════════════════════════════════════════════════════
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

const flattenTree = (nodes, depth = 0) => {
  const out = [];
  nodes.forEach((n) => {
    out.push({ ...n, depth });
    out.push(...flattenTree(n.children || [], depth + 1));
  });
  return out;
};

// ═════════════════════════════════════════════════════════════════════
//  Confirm modal
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
//  Prompt modal (create / rename folder)
// ═════════════════════════════════════════════════════════════════════
const PromptModal = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = 'Folder name',
  initialValue = '',
  submitLabel = 'Save',
  brandColor,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
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
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f12] text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-opacity-30 focus:border-transparent transition"
          style={{ '--tw-ring-color': brandColor }}
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
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: brandColor }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Move-note modal
// ═════════════════════════════════════════════════════════════════════
const MoveNoteModal = ({ isOpen, onClose, note, tree, onMove, brandColor }) => {
  const flat = useMemo(() => flattenTree(tree), [tree]);
  if (!isOpen || !note) return null;
  const current = note.folder?._id || note.folder || null;

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
        <div className="flex-1 overflow-y-auto p-2 ws-notes-scroll">
          <button
            onClick={() => onMove(note._id, null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
              current === null
                ? 'text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={current === null ? { backgroundColor: brandColor } : undefined}
          >
            <FaInbox className="text-xs" />
            <span className="truncate">No folder (root)</span>
          </button>

          {flat.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No folders yet — create one first.
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
                    ? 'text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={{
                  paddingLeft: 12 + f.depth * 14,
                  ...(isCurrent ? { backgroundColor: brandColor } : {}),
                }}
              >
                <FaFolder className="text-xs flex-shrink-0" />
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
//  Folder tree node — flat, no rounded selection pill
// ═════════════════════════════════════════════════════════════════════
const FolderNode = ({
  folder, depth, selectedId, onSelect, onContextMenu, expandedIds, toggleExpand, brandColor,
}) => {
  const hasChildren = folder.children?.length > 0;
  const isExpanded = expandedIds.has(folder._id);
  const isSelected = selectedId === folder._id;

  return (
    <>
      <div
        className={`group flex items-center gap-1 cursor-pointer select-none ${
          isSelected
            ? 'text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{
          paddingLeft: 4 + depth * 12,
          paddingRight: 4,
          ...(isSelected ? { backgroundColor: brandColor } : {}),
        }}
        onClick={() => onSelect(folder._id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleExpand(folder._id);
          }}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${
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
          <FaFolderOpen className="text-xs flex-shrink-0" />
        ) : (
          <FaFolder className="text-gray-400 text-xs flex-shrink-0" />
        )}

        <span className="text-xs truncate flex-1 py-1.5">{folder.name}</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, folder);
          }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 transition flex-shrink-0 hover:bg-black/5 dark:hover:bg-white/5"
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
              brandColor={brandColor}
            />
          ))}
        </>
      )}
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Folder context menu
// ═════════════════════════════════════════════════════════════════════
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

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: Math.min(pos.x, Math.max(0, window.innerWidth - 200)),
        top: Math.min(pos.y, Math.max(0, window.innerHeight - 160)),
        width: 190,
        zIndex: 200,
      }}
      className="bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1"
    >
      <button
        onClick={() => { onNewSubfolder(); onClose(); }}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
      >
        <FaFolderPlus className="text-xs" /> New subfolder
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
//  Note card — flat, divider-separated (matches Notes.jsx)
// ═════════════════════════════════════════════════════════════════════
const NoteCard = ({
  note, onClick, onDelete, onMove, onExport, brandColor,
}) => {
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

  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const preview = stripHtml(note.content).slice(0, 160);
  const folderName = note.folder?.name;

  const menuStyle = menuPos
    ? {
        position: 'fixed',
        left: Math.min(menuPos.x, Math.max(0, window.innerWidth - 220)),
        top: Math.min(menuPos.y, Math.max(0, window.innerHeight - 220)),
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
            <FaFileAlt className="text-sm flex-shrink-0" style={{ color: brandColor }} />
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {note.title || 'Untitled note'}
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {preview || 'Empty note'}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            <span>
              Updated {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
            </span>
            {folderName && (
              <span className="flex items-center gap-1">
                <FaFolder className="text-[9px]" /> {folderName}
              </span>
            )}
            {note.attachments?.length > 0 && (
              <span>
                {note.attachments.length} attachment
                {note.attachments.length === 1 ? '' : 's'}
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
                ? 'bg-gray-100 dark:bg-gray-800'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={showMenu ? { color: brandColor } : undefined}
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
              <button
                type="button"
                onClick={() => { onMove(note); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
              >
                <FaFolder className="text-xs" style={{ color: brandColor }} />
                Move to folder…
              </button>

              <button
                type="button"
                onClick={() => { onExport(note); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
              >
                <FaDownload className="text-xs" /> Export as PDF
              </button>

              <button
                type="button"
                onClick={() => { onDelete(note); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
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
//  Main
// ═════════════════════════════════════════════════════════════════════
const YourWorkspaceNotes = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  // 'all' | 'root' | <folderId>
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const [folderMenu, setFolderMenu] = useState(null);

  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const isCreatingRef = useRef(false);

  // ── Queries ─────────────────────────────────────────────────────
  const { data: wsData, isLoading: wsLoading, error: wsError } =
    useGetWorkspaceQuery(workspaceId);

  const notesArg = selectedFolder === 'all'
    ? { workspaceId }
    : { workspaceId, folderId: selectedFolder };

  const { data: notesData, isLoading: notesLoading } =
    useGetWorkspaceNotesQuery(notesArg, { skip: !workspaceId });

  const { data: foldersData, isLoading: foldersLoading } =
    useGetWorkspaceNoteFoldersQuery(workspaceId, { skip: !workspaceId });

  // ── Mutations ────────────────────────────────────────────────────
  const [createNote] = useCreateWorkspaceNoteMutation();
  const [deleteNote] = useDeleteWorkspaceNoteMutation();
  const [moveNote] = useMoveWorkspaceNoteMutation();
  const [createFolder] = useCreateWorkspaceNoteFolderMutation();
  const [updateFolder] = useUpdateWorkspaceNoteFolderMutation();
  const [deleteFolder] = useDeleteWorkspaceNoteFolderMutation();
  const [triggerExportPDF] = useLazyExportWorkspaceNotePDFQuery();

  const workspace = wsData?.workspace;
  const brandColor = workspace?.color || '#0d9488';
  const notes = notesData?.notes || [];
  const folders = foldersData?.folders || [];
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  // Redirect if workspace errors out
  useEffect(() => {
    if (wsError) navigate('/my-workspaces');
  }, [wsError, navigate]);

  // Expand top-level folders on first load
  useEffect(() => {
    if (folders.length > 0 && expandedIds.size === 0) {
      const roots = folders.filter((f) => !f.parent).map((f) => f._id);
      setExpandedIds(new Set(roots));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders.length]);

  // Reset selection if the current folder was deleted elsewhere
  useEffect(() => {
    if (selectedFolder === 'all' || selectedFolder === 'root') return;
    const exists = folders.some((f) => f._id === selectedFolder);
    if (!exists && !foldersLoading) setSelectedFolder('all');
  }, [folders, foldersLoading, selectedFolder]);

  const currentFolderName = useMemo(() => {
    if (selectedFolder === 'all') return 'All Notes';
    if (selectedFolder === 'root') return 'Unfiled';
    const found = folders.find((f) => f._id === selectedFolder);
    return found?.name || 'All Notes';
  }, [selectedFolder, folders]);

  // ── Handlers ─────────────────────────────────────────────────────
  const openNote = (noteId) => {
    navigate(`/workspace/${workspaceId}/notes/${noteId}`);
  };

  const handleCreateNote = async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreatingNote(true);
    try {
      const folderId = selectedFolder === 'all' || selectedFolder === 'root'
        ? null
        : selectedFolder;

      const result = await createNote({
        workspaceId,
        title: '',
        content: '',
        folderId,
      }).unwrap();

      navigate(`/workspace/${workspaceId}/notes/${result.note._id}`, {
        state: { justCreated: true },
      });
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create note');
    } finally {
      isCreatingRef.current = false;
      setIsCreatingNote(false);
    }
  };

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

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      await deleteFolder({ folderId: folderToDelete._id }).unwrap();
      toast.success('Folder deleted');
      if (selectedFolder === folderToDelete._id) setSelectedFolder('all');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete folder');
    } finally {
      setFolderToDelete(null);
    }
  };

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

  const handleExport = useCallback(async (note) => {
    try {
      const blob = await triggerExportPDF(note._id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WorkspaceNote-${(note.title || 'Untitled').replace(/[^\w\-]+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export PDF');
    }
  }, [triggerExportPDF]);

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
          workspaceId,
          name,
          parentId: promptState.parentId || null,
        }).unwrap();
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

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Folder tree panel (shared between desktop column + mobile drawer) ─
  const FolderTreePanel = () => (
    <div className="flex flex-col h-full">
      <div className="pb-1">
        <div
          onClick={() => { setSelectedFolder('all'); setFolderDrawerOpen(false); }}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none transition ${
            selectedFolder === 'all'
              ? 'text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={selectedFolder === 'all' ? { backgroundColor: brandColor } : undefined}
        >
          <FaFileAlt className="text-xs flex-shrink-0" />
          <span className="text-xs font-medium truncate">All Notes</span>
        </div>
        <div
          onClick={() => { setSelectedFolder('root'); setFolderDrawerOpen(false); }}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none transition ${
            selectedFolder === 'root'
              ? 'text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={selectedFolder === 'root' ? { backgroundColor: brandColor } : undefined}
        >
          <FaInbox className="text-xs flex-shrink-0" />
          <span className="text-xs font-medium truncate">Unfiled</span>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-1">
        {foldersLoading ? (
          <div className="flex items-center justify-center py-4">
            <FaSpinner className="animate-spin text-sm" style={{ color: brandColor }} />
          </div>
        ) : tree.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4 px-2">
            No folders yet.
          </p>
        ) : (
          <div>
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
                brandColor={brandColor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────
  if (wsLoading) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
          <div className="hidden md:block md:w-72 md:flex-shrink-0">
            <YourWorkspaceSidebar />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <FaSpinner className="animate-spin text-3xl" style={{ color: '#0d9488' }} />
          </div>
        </div>
      </>
    );
  }
  if (!workspace) return null;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <GlobalStyles />

      <div className="h-dvh bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row overflow-hidden">
        {/* Workspace sidebar (desktop) */}
        <div className="hidden md:block md:flex-shrink-0">
          <YourWorkspaceSidebar workspace={workspace} />
        </div>

        {/* Folders sidebar (desktop) */}
        <aside className="hidden md:flex md:w-60 md:flex-shrink-0 border-r border-gray-100 dark:border-gray-800 flex-col bg-white dark:bg-[#0f0f12]">
          <header className="h-12 px-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Folders
            </h2>
            <button
              onClick={() => setPromptState({ mode: 'create', parentId: null })}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
              style={{ color: brandColor }}
              title="New folder"
              aria-label="New folder"
            >
              <FaFolderPlus className="text-xs" />
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto py-2 ws-notes-scroll">
            <FolderTreePanel />
          </div>
        </aside>

        {/* Notes list column */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 flex-shrink-0 ws-mobile-header md:!pt-0">
            <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
              {/* Mobile folder drawer trigger */}
              <button
                onClick={() => setFolderDrawerOpen(true)}
                className="md:hidden p-1.5 -ml-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                aria-label="Open folders"
              >
                <FaFolderOpen className="text-sm" />
              </button>

              <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2 flex-1 min-w-0">
                <FaFileAlt
                  className="text-sm hidden sm:block flex-shrink-0"
                  style={{ color: brandColor }}
                />
                <span className="truncate">{currentFolderName}</span>
              </h1>

              <button
                onClick={handleCreateNote}
                disabled={isCreatingNote}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: brandColor }}
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
          <div className="ws-mobile-header-spacer md:hidden" />

          <main
            className="flex-1 min-h-0 overflow-y-auto"
            style={{
              paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {notesLoading ? (
              <div className="flex items-center justify-center py-16">
                <FaSpinner
                  className="animate-spin text-lg"
                  style={{ color: brandColor }}
                />
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                <FaFileAlt className="text-3xl mb-2 opacity-30" />
                <p className="text-sm font-medium">
                  {selectedFolder === 'all'
                    ? 'No notes yet'
                    : `No notes in "${currentFolderName}"`}
                </p>
                <p className="text-xs mt-1">Tap the + button to create one.</p>
              </div>
            ) : (
              <div className="md:pb-6">
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    brandColor={brandColor}
                    onClick={() => openNote(note._id)}
                    onDelete={setDeleteTarget}
                    onMove={setMoveTarget}
                    onExport={handleExport}
                  />
                ))}
              </div>
            )}
          </main>

          <YourWorkspaceBottombar workspace={workspace} />
        </div>
      </div>

      {/* Mobile floating action button */}
      <button
        onClick={handleCreateNote}
        disabled={isCreatingNote}
        className="md:hidden fixed right-4 z-40 w-12 h-12 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
        style={{
          bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
          backgroundColor: brandColor,
          boxShadow: `0 8px 24px ${brandColor}55`,
        }}
        aria-label="New note"
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
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-white dark:bg-[#0f0f12] shadow-xl flex flex-col border-r border-gray-100 dark:border-gray-800">
            <div
              className="h-14 px-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 flex-shrink-0 ws-mobile-header"
            >
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Folders
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPromptState({ mode: 'create', parentId: null });
                    setFolderDrawerOpen(false);
                  }}
                  className="p-1.5 transition"
                  style={{ color: brandColor }}
                  aria-label="New folder"
                >
                  <FaFolderPlus className="text-sm" />
                </button>
                <button
                  onClick={() => setFolderDrawerOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                  aria-label="Close"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-2 ws-notes-scroll">
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

      {/* Modals */}
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
        brandColor={brandColor}
      />

      <MoveNoteModal
        isOpen={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        note={moveTarget}
        tree={tree}
        onMove={handleMove}
        brandColor={brandColor}
      />

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

export default YourWorkspaceNotes;