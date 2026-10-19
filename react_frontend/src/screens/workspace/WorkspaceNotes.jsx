// src/screens/workspace/WorkspaceNotes.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetWorkspaceQuery } from '../../slices/workspaceApiSlice';
import {
  useGetWorkspaceNotesQuery,
  useCreateWorkspaceNoteMutation,
  useDeleteWorkspaceNoteMutation,
  useMoveWorkspaceNoteMutation,
  useUpdateWorkspaceNoteColorMutation,
  useGetWorkspaceNoteFoldersQuery,
  useCreateWorkspaceNoteFolderMutation,
  useUpdateWorkspaceNoteFolderMutation,
  useUpdateWorkspaceNoteFolderColorMutation,
  useDeleteWorkspaceNoteFolderMutation,
  useLazyExportWorkspaceNotePDFQuery,
} from '../../slices/workspaceNoteApiSlice';
import WorkspaceSidebar from '../../components/WorkspaceSidebar';
import WorkspaceBottombar from '../../components/WorkspaceBottombar';
import { toast } from 'react-toastify';
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
  FaTimes,
  FaDownload,
  FaCheck,
  FaCheckSquare,
  FaTh,
  FaList,
  FaCheckDouble,
  FaPalette,
} from 'react-icons/fa';

// ─── Base path (keep in sync with WorkspaceSidebar / WorkspaceBottombar / WorkspaceId / WorkspaceProjects / WorkspaceProjectId) ──
const WORKSPACE_BASE_PATH = '/workspace';

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
    .line-clamp-3 {
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .ws-notes-root,
    .ws-notes-root > * {
      margin-left: 0 !important;
    }

    .ws-note-card {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  `}</style>
);

// ═════════════════════════════════════════════════════════════════════
//  Color palette
// ═════════════════════════════════════════════════════════════════════
const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];

// ═════════════════════════════════════════════════════════════════════
//  Color picker grid
// ═════════════════════════════════════════════════════════════════════
const ColorPickerGrid = ({ value, onPick, onClear, label = 'Color' }) => (
  <div className="p-3">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
      {label}
    </div>
    <div className="grid grid-cols-6 gap-2 mb-3">
      {COLOR_PRESETS.map((c) => {
        const active = (value || '').toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className={`w-6 h-6 rounded-full border-2 transition ${
              active
                ? 'border-gray-900 dark:border-white scale-110'
                : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        );
      })}
    </div>
    <div className="flex items-center gap-2">
      <label className="relative flex-1 h-8 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition">
        <FaPalette className="text-xs" />
        <span>Custom</span>
        <input
          type="color"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#888888'}
          onChange={(e) => onPick(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <button
        type="button"
        onClick={onClear}
        className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition"
      >
        None
      </button>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════
//  Folder helpers
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

// Extract a folder id from any shape note.folder / note.folderId might have
const extractFolderId = (note) => {
  if (!note) return null;
  const raw = note.folder ?? note.folderId ?? null;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  return raw._id || null;
};

// ═════════════════════════════════════════════════════════════════════
//  Confirm modal  (centered on all screens)
// ═════════════════════════════════════════════════════════════════════
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', busy = false }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto ws-notes-scroll p-6 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition disabled:opacity-40"
          >
            <FaTimes />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <FaSpinner className="animate-spin text-xs" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  Prompt modal  (centered on all screens)
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
  showColor = false,
  initialColor = null,
}) => {
  const [value, setValue] = useState(initialValue);
  const [color, setColor] = useState(initialColor);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setColor(initialColor);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen, initialValue, initialColor]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, color });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-sm w-full max-h-[85vh] overflow-y-auto ws-notes-scroll shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 pb-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <FaTimes />
          </button>
        </div>

        <div className="px-5">
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

          {showColor && (
            <div className="mt-3">
              <ColorPickerGrid
                value={color}
                onPick={setColor}
                onClear={() => setColor(null)}
                label="Folder color (optional)"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-4">
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
//  Folder picker modal  (centered on all screens)
// ═════════════════════════════════════════════════════════════════════
const FolderPickerModal = ({
  isOpen,
  onClose,
  tree,
  currentFolderId,
  onPick,
  brandColor,
  title = 'Move to folder',
  busy = false,
}) => {
  const flat = useMemo(() => flattenTree(tree), [tree]);
  if (!isOpen) return null;
  const current = currentFolderId || null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-sm max-h-[80vh] shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white disabled:opacity-40"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 ws-notes-scroll">
          <button
            onClick={() => !busy && onPick(null)}
            disabled={busy}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition disabled:opacity-60 ${
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
                onClick={() => !busy && onPick(f._id)}
                disabled={busy}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition disabled:opacity-60 ${
                  isCurrent
                    ? 'text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={{
                  paddingLeft: 12 + f.depth * 14,
                  ...(isCurrent ? { backgroundColor: brandColor } : {}),
                }}
              >
                <FaFolder
                  className="text-xs flex-shrink-0"
                  style={!isCurrent && f.color ? { color: f.color } : undefined}
                />
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
//  Folder tree node
// ═════════════════════════════════════════════════════════════════════
const FolderNode = ({
  folder, depth, selectedId, onSelect, onContextMenu, expandedIds, toggleExpand, brandColor,
}) => {
  const hasChildren = folder.children?.length > 0;
  const isExpanded = expandedIds.has(folder._id);
  const isSelected = selectedId === folder._id;
  const folderColor = folder.color;

  return (
    <>
      <div
        className={`group flex items-center gap-1 cursor-pointer select-none rounded-md mx-1 ${
          isSelected
            ? 'text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{
          paddingLeft: 4 + depth * 12,
          paddingRight: 4,
          ...(isSelected ? { backgroundColor: folderColor || brandColor } : {}),
        }}
        onClick={() => onSelect(folder._id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleExpand(folder._id);
          }}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${
            hasChildren ? 'hover:bg-black/5 dark:hover:bg-white/5 rounded' : 'invisible'
          }`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <FaChevronDown className="text-[8px]" />
          ) : (
            <FaChevronRight className="text-[8px]" />
          )}
        </button>

        {folderColor && !isSelected ? (
          <span
            className="flex-shrink-0 w-2 h-2 rounded-full mr-1"
            style={{ backgroundColor: folderColor }}
            aria-hidden
          />
        ) : null}

        {isSelected || isExpanded ? (
          <FaFolderOpen
            className="text-xs flex-shrink-0"
            style={!isSelected && folderColor ? { color: folderColor } : undefined}
          />
        ) : (
          <FaFolder
            className="text-xs flex-shrink-0"
            style={folderColor ? { color: folderColor } : { color: '#9ca3af' }}
          />
        )}

        <span className="text-xs truncate flex-1 py-1.5">{folder.name}</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, folder);
          }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 transition flex-shrink-0 hover:bg-black/5 dark:hover:bg-white/5 rounded"
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
const FolderContextMenu = ({
  pos,
  onClose,
  onRename,
  onDelete,
  onNewSubfolder,
  onColorChange,
  currentColor,
}) => {
  const menuRef = useRef(null);
  const [mode, setMode] = useState('main');

  useEffect(() => {
    setMode('main');
  }, [pos]);

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

  const outerStyle = {
    position: 'fixed',
    left: Math.min(pos.x, Math.max(0, window.innerWidth - 240)),
    top: Math.min(pos.y, Math.max(0, window.innerHeight - 260)),
    width: mode === 'color' ? 240 : 190,
    zIndex: 200,
  };

  if (mode === 'color') {
    return (
      <div
        ref={menuRef}
        style={outerStyle}
        className="bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
      >
        <ColorPickerGrid
          value={currentColor}
          onPick={(c) => { onColorChange?.(c); onClose(); }}
          onClear={() => { onColorChange?.(null); onClose(); }}
          label="Folder color"
        />
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      style={outerStyle}
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
        onClick={() => setMode('color')}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
      >
        <FaPalette className="text-xs" />
        Color
        <span className="ml-auto flex items-center gap-1">
          {currentColor ? (
            <span
              className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: currentColor }}
            />
          ) : null}
          <FaChevronRight className="text-[9px] opacity-60" />
        </span>
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
//  Selection checkbox
// ═════════════════════════════════════════════════════════════════════
const SelectionCheckbox = ({ selected, brandColor }) => (
  <span
    className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition ${
      selected ? 'text-white' : 'border-gray-300 dark:border-gray-600'
    }`}
    style={selected ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
  >
    {selected && <FaCheck className="text-[9px]" />}
  </span>
);

// ═════════════════════════════════════════════════════════════════════
//  Note card
// ═════════════════════════════════════════════════════════════════════
const NoteCard = ({
  note,
  viewMode,
  brandColor,
  selectionMode,
  isSelected,
  onToggleSelect,
  onEnterSelection,
  onClick,
  onDelete,
  onMove,
  onExport,
  onColorChange,
  folders = [],
  showFolderBadge = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [menuMode, setMenuMode] = useState('main');
  const wrapperRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    if (!showMenu) return;
    const handlePointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowMenu(false);
        setMenuPos(null);
        setMenuMode('main');
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setMenuPos(null);
        setMenuMode('main');
      }
    };
    const handleScroll = () => {
      setShowMenu(false);
      setMenuPos(null);
      setMenuMode('main');
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

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = () => {
    if (selectionMode) return;
    longPressFiredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(15); } catch { /* noop */ }
      }
      onEnterSelection?.(note._id);
    }, 450);
  };
  const handleTouchEnd = () => clearLongPress();
  const handleTouchMove = () => clearLongPress();

  const handleClick = (e) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(note._id);
      return;
    }
    onClick?.();
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectionMode) {
      onToggleSelect?.(note._id);
      return;
    }
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuMode('main');
    setShowMenu(true);
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    setMenuPos(null);
    setMenuMode('main');
    setShowMenu((v) => !v);
  };

  const closeMenu = () => {
    setShowMenu(false);
    setMenuPos(null);
    setMenuMode('main');
  };

  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const preview = stripHtml(note.content).slice(0, 160);
  const isGrid = viewMode === 'grid';
  const noteColor = note.color;

  // ── Resolve folder info: handles populated object OR raw id ────
  const folderId = extractFolderId(note);
  const folderFromList = folderId
    ? folders.find((f) => f._id === folderId)
    : null;
  const populatedFolder =
    note.folder && typeof note.folder === 'object' ? note.folder : null;

  const folderName =
    folderFromList?.name || populatedFolder?.name || null;
  const folderColor =
    folderFromList?.color || populatedFolder?.color || null;

  // ── Menu geometry ─────────────────────────────────────────────
  const menuWidth = menuMode === 'color' ? 240 : 200;

  const menuStyle = menuPos
    ? {
        position: 'fixed',
        left: Math.min(menuPos.x, Math.max(0, window.innerWidth - (menuWidth + 20))),
        top: Math.min(menuPos.y, Math.max(0, window.innerHeight - 300)),
        width: menuWidth,
        zIndex: 100,
      }
    : { width: menuWidth };

  const menuClassName = menuPos
    ? 'bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 overflow-hidden'
    : 'absolute right-0 top-full mt-1 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-20 overflow-hidden';

  // ── Folder badge ──────────────────────────────────────────────
  const renderFolderBadge = () => {
    if (!showFolderBadge || !folderName) return null;
    return (
      <span
        className="inline-flex items-center gap-1 min-w-0 max-w-[140px] text-[10px] text-gray-500 dark:text-gray-400"
        title={folderName}
      >
        <FaFolder
          className="text-[8px] flex-shrink-0"
          style={folderColor ? { color: folderColor } : undefined}
        />
        <span className="truncate">{folderName}</span>
      </span>
    );
  };

  // ── Menu content ──────────────────────────────────────────────
  const renderMenuContent = () => {
    if (menuMode === 'color') {
      return (
        <ColorPickerGrid
          value={noteColor}
          onPick={(c) => { onColorChange?.(note._id, c); closeMenu(); }}
          onClear={() => { onColorChange?.(note._id, null); closeMenu(); }}
          label="Note color"
        />
      );
    }
    return (
      <>
        <button
          type="button"
          onClick={() => { onEnterSelection?.(note._id); closeMenu(); }}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
        >
          <FaCheckSquare className="text-xs" style={{ color: brandColor }} />
          Select
        </button>

        <button
          type="button"
          onClick={() => setMenuMode('color')}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
        >
          <FaPalette className="text-xs" style={{ color: brandColor }} />
          Color
          <span className="ml-auto flex items-center gap-1">
            {noteColor ? (
              <span
                className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: noteColor }}
              />
            ) : null}
            <FaChevronRight className="text-[9px] opacity-60" />
          </span>
        </button>

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
          <FaDownload className="text-xs" />
          Export as PDF
        </button>
        <button
          type="button"
          onClick={() => { onDelete(note); closeMenu(); }}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
        >
          <FaTrashAlt className="text-xs" /> Delete
        </button>
      </>
    );
  };

  // ── Grid variant ──────────────────────────────────────────────
  if (isGrid) {
    return (
      <div
        className={`ws-note-card relative bg-white dark:bg-[#131316] rounded-xl border transition cursor-pointer flex flex-col p-3 min-h-[130px] ${
          isSelected
            ? 'shadow-sm'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm'
        }`}
        style={
          isSelected
            ? { borderColor: brandColor, boxShadow: `0 0 0 1px ${brandColor}` }
            : noteColor
            ? { borderLeftWidth: 3, borderLeftColor: noteColor }
            : undefined
        }
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {selectionMode && (
              <SelectionCheckbox selected={isSelected} brandColor={brandColor} />
            )}
            <FaFileAlt
              className="text-sm flex-shrink-0"
              style={{ color: noteColor || brandColor }}
            />
          </div>

          <div
            ref={wrapperRef}
            className="flex-shrink-0 flex items-center relative"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {!selectionMode && (
              <button
                type="button"
                onClick={toggleMenu}
                className={`p-1 rounded-md transition ${
                  showMenu
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={showMenu ? { color: brandColor } : undefined}
                aria-label="Note options"
              >
                <FaEllipsisV className="text-xs" />
              </button>
            )}

            {showMenu && !selectionMode && (
              <div
                style={menuStyle}
                className={menuClassName}
                onClick={(e) => e.stopPropagation()}
              >
                {renderMenuContent()}
              </div>
            )}
          </div>
        </div>

        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">
          {note.title || 'Untitled note'}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 flex-1">
          {preview || 'Empty note'}
        </p>

        {/* Footer: timestamp + optional folder badge */}
        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 mt-2 min-w-0">
          <span className="truncate flex-shrink-0">
            {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
          </span>
          {renderFolderBadge()}
        </div>
      </div>
    );
  }

  // ── List variant ──────────────────────────────────────────────
  return (
    <div
      className={`ws-note-card bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 px-4 py-3 transition cursor-pointer relative ${
        isSelected
          ? 'bg-gray-50 dark:bg-[#1c1c20]'
          : 'hover:bg-gray-50 dark:hover:bg-[#1e1e1e]'
      }`}
      style={
        isSelected
          ? { boxShadow: `inset 3px 0 0 ${brandColor}` }
          : noteColor
          ? { boxShadow: `inset 3px 0 0 ${noteColor}` }
          : undefined
      }
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {selectionMode && (
            <div className="pt-0.5">
              <SelectionCheckbox selected={isSelected} brandColor={brandColor} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FaFileAlt
                className="text-sm flex-shrink-0"
                style={{ color: noteColor || brandColor }}
              />
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
              {renderFolderBadge()}
              {note.attachments?.length > 0 && (
                <span>
                  {note.attachments.length} attachment
                  {note.attachments.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          ref={wrapperRef}
          className="flex-shrink-0 flex items-center gap-1 relative"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {!selectionMode && (
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
          )}

          {showMenu && !selectionMode && (
            <div
              style={menuStyle}
              className={menuClassName}
              onClick={(e) => e.stopPropagation()}
            >
              {renderMenuContent()}
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
const VIEW_MODE_KEY = 'xircle.workspaceNotes.viewMode';
const readViewMode = () => {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    // Grid is the default; only honor an explicit "list" preference.
    return v === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

const WorkspaceNotes = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

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

  const [viewMode, setViewMode] = useState(readViewMode);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* noop */ }
  }, [viewMode]);

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
  const [updateNoteColor] = useUpdateWorkspaceNoteColorMutation();
  const [createFolder] = useCreateWorkspaceNoteFolderMutation();
  const [updateFolder] = useUpdateWorkspaceNoteFolderMutation();
  const [updateFolderColor] = useUpdateWorkspaceNoteFolderColorMutation();
  const [deleteFolder] = useDeleteWorkspaceNoteFolderMutation();
  const [triggerExportPDF] = useLazyExportWorkspaceNotePDFQuery();

  const workspace = wsData?.workspace;
  const brandColor = workspace?.color || '#0d9488';
  const notes = notesData?.notes || [];
  const folders = foldersData?.folders || [];
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  useEffect(() => {
    if (wsError) navigate('/my-workspaces');
  }, [wsError, navigate]);

  useEffect(() => {
    if (folders.length > 0 && expandedIds.size === 0) {
      const roots = folders.filter((f) => !f.parent).map((f) => f._id);
      setExpandedIds(new Set(roots));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders.length]);

  useEffect(() => {
    if (selectedFolder === 'all' || selectedFolder === 'root') return;
    const exists = folders.some((f) => f._id === selectedFolder);
    if (!exists && !foldersLoading) setSelectedFolder('all');
  }, [folders, foldersLoading, selectedFolder]);

  useEffect(() => {
    if (!selectionMode) setSelectedIds(new Set());
  }, [selectionMode]);

  useEffect(() => {
    if (!selectionMode) return;
    const valid = new Set(notes.map((n) => n._id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const currentFolderName = useMemo(() => {
    if (selectedFolder === 'all') return 'All Notes';
    if (selectedFolder === 'root') return 'Unfiled';
    const found = folders.find((f) => f._id === selectedFolder);
    return found?.name || 'All Notes';
  }, [selectedFolder, folders]);

  // Show badge only when looking at "All Notes"
  const showFolderBadge = selectedFolder === 'all';

  // ── Selection handlers ──────────────────────────────────────────
  const enterSelectionMode = (firstId) => {
    setSelectionMode(true);
    setSelectedIds(new Set(firstId ? [firstId] : []));
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(notes.map((n) => n._id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;
  const allSelected = notes.length > 0 && selectedCount === notes.length;

  // ── Handlers ─────────────────────────────────────────────────────
  const openNote = (noteId) => {
    navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/notes/${noteId}`);
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

      navigate(`${WORKSPACE_BASE_PATH}/${workspaceId}/notes/${result.note._id}`, {
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

  const handleNoteColorChange = async (noteId, color) => {
    try {
      await updateNoteColor({ noteId, color }).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to change note color');
    }
  };

  const handleFolderColorChange = async (folderId, color) => {
    try {
      await updateFolderColor({ folderId, color }).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to change folder color');
    }
  };

  // ── Bulk actions ─────────────────────────────────────────────────
  const runBulk = useCallback(async (ids, fn) => {
    if (!ids.length) return { ok: 0, failed: 0 };
    const results = await Promise.allSettled(ids.map((id) => fn(id).unwrap()));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return { ok, failed: results.length - ok };
  }, []);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await runBulk(ids, (id) => deleteNote(id));
      if (failed === 0) {
        toast.success(`${ok} note${ok === 1 ? '' : 's'} deleted`);
      } else if (ok === 0) {
        toast.error('Failed to delete selected notes');
      } else {
        toast.error(`${failed} of ${ids.length} notes failed to delete`);
      }
      exitSelectionMode();
      setBulkDeleteOpen(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkMove = async (folderId) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await runBulk(ids, (id) => moveNote({ noteId: id, folderId }));
      const label = folderId ? 'moved' : 'moved to root';
      if (failed === 0) {
        toast.success(`${ok} note${ok === 1 ? '' : 's'} ${label}`);
      } else if (ok === 0) {
        toast.error('Failed to move selected notes');
      } else {
        toast.error(`${failed} of ${ids.length} notes failed to move`);
      }
      exitSelectionMode();
      setBulkMoveOpen(false);
    } finally {
      setBulkBusy(false);
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

  const handleFolderPromptSubmit = async ({ name, color }) => {
    if (!promptState) return;
    try {
      if (promptState.mode === 'create' || promptState.mode === 'create-sub') {
        await createFolder({
          workspaceId,
          name,
          parentId: promptState.parentId || null,
          color: color || null,
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

  // ── Folder tree panel ─────────────────────────────────────────
  const FolderTreePanel = () => (
    <div className="flex flex-col h-full py-1">
      <div className="pb-1">
        <div
          onClick={() => { setSelectedFolder('all'); setFolderDrawerOpen(false); }}
          className={`flex items-center gap-2 mx-1 px-3 py-1.5 rounded-md cursor-pointer select-none transition text-xs font-medium ${
            selectedFolder === 'all'
              ? 'text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={selectedFolder === 'all' ? { backgroundColor: brandColor } : undefined}
        >
          <FaFileAlt className="text-xs flex-shrink-0" />
          <span className="truncate">All Notes</span>
        </div>
        <div
          onClick={() => { setSelectedFolder('root'); setFolderDrawerOpen(false); }}
          className={`flex items-center gap-2 mx-1 px-3 py-1.5 rounded-md cursor-pointer select-none transition text-xs font-medium ${
            selectedFolder === 'root'
              ? 'text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={selectedFolder === 'root' ? { backgroundColor: brandColor } : undefined}
        >
          <FaInbox className="text-xs flex-shrink-0" />
          <span className="truncate">Unfiled</span>
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
          <div className="space-y-px">
            {tree.map((f) => (
              <FolderNode
                key={f._id}
                folder={f}
                depth={0}
                selectedId={selectedFolder}
                onSelect={(id) => {
                  setSelectedFolder(id);
                  setFolderDrawerOpen(false);
                  if (selectionMode) exitSelectionMode();
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
        <div className="ws-notes-root h-dvh w-full bg-gray-50 dark:bg-[#0b0b10] flex">
          <div className="hidden md:flex flex-shrink-0">
            <WorkspaceSidebar />
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

      <div className="ws-notes-root h-dvh w-full bg-white dark:bg-[#0f0f12] flex overflow-hidden">
        {/* ── 1. Workspace sidebar (desktop) ─────────────────────── */}
        <div className="hidden md:flex flex-shrink-0 h-full">
          <WorkspaceSidebar workspace={workspace} />
        </div>

        {/* ── 2. Folders sidebar (desktop) ───────────────────────── */}
        <aside className="hidden md:flex md:w-60 md:flex-shrink-0 h-full border-r border-gray-100 dark:border-gray-800 flex-col bg-white dark:bg-[#0f0f12]">
          <header className="h-12 px-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Folders
            </h2>
            <button
              onClick={() => setPromptState({ mode: 'create', parentId: null })}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              style={{ color: brandColor }}
              title="New folder"
              aria-label="New folder"
            >
              <FaFolderPlus className="text-xs" />
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto ws-notes-scroll">
            <FolderTreePanel />
          </div>
        </aside>

        {/* ── 3. Notes list column ───────────────────────────────── */}
        <section className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0f0f12]">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30 flex-shrink-0 ws-mobile-header md:!pt-0">
            {selectionMode ? (
              <div className="px-3 sm:px-6 h-12 flex items-center gap-2">
                <button
                  onClick={exitSelectionMode}
                  className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
                  aria-label="Cancel selection"
                >
                  <FaTimes className="text-sm" />
                </button>
                <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                  {selectedCount} selected
                </span>
                <div className="flex-1" />

                <button
                  onClick={allSelected ? clearSelection : selectAll}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                  aria-label={allSelected ? 'Deselect all' : 'Select all'}
                >
                  {allSelected ? (
                    <FaCheckDouble className="text-sm" style={{ color: brandColor }} />
                  ) : (
                    <FaCheckSquare className="text-sm" />
                  )}
                </button>

                <button
                  onClick={() => setBulkMoveOpen(true)}
                  disabled={selectedCount === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-white transition disabled:opacity-40 flex items-center gap-1.5"
                  style={{ backgroundColor: brandColor }}
                  title="Move selected"
                >
                  <FaFolder className="text-xs" />
                  <span className="hidden xs:inline">Move</span>
                </button>

                <button
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={selectedCount === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-40 flex items-center gap-1.5"
                  title="Delete selected"
                >
                  <FaTrashAlt className="text-xs" />
                  <span className="hidden xs:inline">Delete</span>
                </button>
              </div>
            ) : (
              <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
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

                <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 transition ${
                      viewMode === 'list'
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`}
                    style={viewMode === 'list' ? { color: brandColor } : undefined}
                    title="List view"
                    aria-label="List view"
                  >
                    <FaList className="text-xs" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 transition border-l border-gray-200 dark:border-gray-700 ${
                      viewMode === 'grid'
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`}
                    style={viewMode === 'grid' ? { color: brandColor } : undefined}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <FaTh className="text-xs" />
                  </button>
                </div>

                <button
                  onClick={handleCreateNote}
                  disabled={isCreatingNote}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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
            )}
          </header>
          <div className="ws-mobile-header-spacer md:hidden" />

          <main
            className="flex-1 min-h-0 overflow-y-auto ws-notes-scroll"
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
            ) : viewMode === 'grid' ? (
              <div className="p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    viewMode="grid"
                    brandColor={brandColor}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(note._id)}
                    onToggleSelect={toggleSelect}
                    onEnterSelection={enterSelectionMode}
                    onClick={() => openNote(note._id)}
                    onDelete={setDeleteTarget}
                    onMove={setMoveTarget}
                    onExport={handleExport}
                    onColorChange={handleNoteColorChange}
                    folders={folders}
                    showFolderBadge={showFolderBadge}
                  />
                ))}
              </div>
            ) : (
              <div className="md:pb-6">
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    viewMode="list"
                    brandColor={brandColor}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(note._id)}
                    onToggleSelect={toggleSelect}
                    onEnterSelection={enterSelectionMode}
                    onClick={() => openNote(note._id)}
                    onDelete={setDeleteTarget}
                    onMove={setMoveTarget}
                    onExport={handleExport}
                    onColorChange={handleNoteColorChange}
                    folders={folders}
                    showFolderBadge={showFolderBadge}
                  />
                ))}
              </div>
            )}
          </main>

          <WorkspaceBottombar workspace={workspace} />
        </section>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={handleCreateNote}
        disabled={isCreatingNote || selectionMode}
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
            <div className="h-14 px-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 flex-shrink-0 ws-mobile-header">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Folders
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPromptState({ mode: 'create', parentId: null });
                    setFolderDrawerOpen(false);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
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
          onColorChange={(color) =>
            handleFolderColorChange(folderMenu.folder._id, color)
          }
          currentColor={folderMenu.folder.color}
        />
      )}

      {/* Prompt modal */}
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
        showColor={promptState?.mode !== 'rename'}
        initialColor={null}
      />

      {/* Single-note move */}
      <FolderPickerModal
        isOpen={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        tree={tree}
        currentFolderId={moveTarget ? extractFolderId(moveTarget) : null}
        onPick={(folderId) => handleMove(moveTarget._id, folderId)}
        brandColor={brandColor}
        title="Move to folder"
      />

      {/* Bulk move */}
      <FolderPickerModal
        isOpen={bulkMoveOpen}
        onClose={() => !bulkBusy && setBulkMoveOpen(false)}
        tree={tree}
        currentFolderId={null}
        onPick={handleBulkMove}
        brandColor={brandColor}
        title={`Move ${selectedCount} note${selectedCount === 1 ? '' : 's'}`}
        busy={bulkBusy}
      />

      {/* Single delete */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Note"
        message="This note will be permanently deleted. This action cannot be undone."
      />

      {/* Bulk delete */}
      <ConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => !bulkBusy && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Notes"
        message={`${selectedCount} note${selectedCount === 1 ? '' : 's'} will be permanently deleted. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedCount}`}
        busy={bulkBusy}
      />

      {/* Folder delete */}
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

export default WorkspaceNotes;