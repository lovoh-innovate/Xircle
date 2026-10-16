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
  useUpdateNoteColorMutation,
  useGetNoteFoldersQuery,
  useCreateNoteFolderMutation,
  useUpdateNoteFolderMutation,
  useUpdateNoteFolderColorMutation,
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
  FaCheck,
  FaCheckSquare,
  FaCheckDouble,
  FaTh,
  FaList,
  FaPalette,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Share URL base ──────────────────────────────────────────────────
const SHARE_BASE_URL = 'https://xircle.lovohcreate.com';

// ═════════════════════════════════════════════════════════════════════
//  Global styles
// ═════════════════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    .notes-scroll::-webkit-scrollbar { width: 6px; }
    .notes-scroll::-webkit-scrollbar-thumb {
      background: rgba(148,163,184,0.3); border-radius: 999px;
    }
    .notes-scroll::-webkit-scrollbar-track { background: transparent; }

    .line-clamp-2 {
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .notes-card {
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

// ─── Folder-tree helpers ─────────────────────────────────────────────
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
//  Confirm Modal  (centered on all screens)
// ═════════════════════════════════════════════════════════════════════
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto notes-scroll p-6 shadow-xl border border-gray-200 dark:border-gray-700">
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
//  Prompt Modal  (centered on all screens)
// ═════════════════════════════════════════════════════════════════════
const PromptModal = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = 'Folder name',
  initialValue = '',
  submitLabel = 'Save',
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
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-sm w-full max-h-[85vh] overflow-y-auto notes-scroll shadow-xl border border-gray-200 dark:border-gray-700">
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
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f12] text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
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
//  Move Note → Folder Modal (single or bulk)  (centered on all screens)
// ═════════════════════════════════════════════════════════════════════
const FolderPickerModal = ({
  isOpen,
  onClose,
  note,
  tree,
  onMove,
  title,
  busy = false,
}) => {
  const flat = useMemo(() => flattenTree(tree), [tree]);
  if (!isOpen) return null;

  // 👈 use the safe extractor, handles both object & id shapes
  const current = extractFolderId(note);
  const heading = title || 'Move to folder';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-sm w-full max-h-[80vh] shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">{heading}</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white disabled:opacity-40"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 notes-scroll">
          <button
            onClick={() => !busy && onMove(null)}
            disabled={busy}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition disabled:opacity-60 ${
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
                onClick={() => !busy && onMove(f._id)}
                disabled={busy}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition disabled:opacity-60 ${
                  isCurrent
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={{ paddingLeft: 12 + f.depth * 14 }}
              >
                <FaFolder
                  className="text-xs flex-shrink-0"
                  style={!isCurrent && f.color ? { color: f.color } : { color: '#9ca3af' }}
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
//  Folder Tree (recursive, with color)
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
  const folderColor = folder.color;

  return (
    <>
      <div
        className={`group flex items-center gap-1 rounded-lg cursor-pointer select-none ${
          isSelected
            ? 'text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{
          paddingLeft: 4 + depth * 12,
          paddingRight: 4,
          // 👈 use the folder's own color when selected, fall back to teal
          ...(isSelected ? { backgroundColor: folderColor || '#14b8a6' } : {}),
        }}
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
            style={
              isSelected
                ? undefined
                : folderColor
                ? { color: folderColor }
                : { color: '#14b8a6' }
            }
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
          className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded transition flex-shrink-0 ${
            isSelected
              ? 'hover:bg-black/10'
              : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'
          }`}
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

  useEffect(() => { setMode('main'); }, [pos]);

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
    left: Math.min(pos.x, Math.max(0, window.innerWidth - 240)),
    top: Math.min(pos.y, Math.max(0, window.innerHeight - 260)),
    width: mode === 'color' ? 240 : 190,
    zIndex: 200,
  };

  if (mode === 'color') {
    return (
      <div
        ref={menuRef}
        style={style}
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
const SelectionCheckbox = ({ selected }) => (
  <span
    className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition ${
      selected ? 'text-white' : 'border-gray-300 dark:border-gray-600'
    }`}
    style={selected ? { backgroundColor: '#14b8a6', borderColor: '#14b8a6' } : undefined}
  >
    {selected && <FaCheck className="text-[9px]" />}
  </span>
);

// ═════════════════════════════════════════════════════════════════════
//  Note menu sizing / styles
// ═════════════════════════════════════════════════════════════════════
const MENU_WIDTH_MAIN = 250;
const MENU_WIDTH_COLOR = 264;
const MENU_GUTTER = 8;
const MENU_EST_HEIGHT = 340;

const menuItemBase =
  'w-full flex items-center gap-3 px-4 py-2.5 sm:py-2 text-sm transition whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800/50';
const menuItem = `${menuItemBase} text-gray-700 dark:text-gray-300`;
const menuItemDanger = `${menuItemBase} text-red-600 dark:text-red-400`;

// ═════════════════════════════════════════════════════════════════════
//  Note Card
// ═════════════════════════════════════════════════════════════════════
const NoteCard = ({
  note,
  viewMode,
  selectionMode,
  isSelected,
  onToggleSelect,
  onEnterSelection,
  onClick,
  onDelete,
  onTogglePublic,
  onShareLink,
  onMove,
  onColorChange,
  folders = [],             // 👈 for badge lookup
  showFolderBadge = false,  // 👈 show tiny folder tag
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
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
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
    const width = MENU_WIDTH_MAIN;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.max(MENU_GUTTER, Math.min(e.clientX, vw - width - MENU_GUTTER));
    let top = Math.max(MENU_GUTTER, Math.min(e.clientY, vh - MENU_EST_HEIGHT));
    setMenuPos({ x: left, y: top });
    setMenuMode('main');
    setShowMenu(true);
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      setMenuPos(null);
      setMenuMode('main');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = MENU_WIDTH_MAIN;

    let left = rect.right - width;
    left = Math.max(MENU_GUTTER, Math.min(left, vw - width - MENU_GUTTER));

    let top = rect.bottom + 6;
    if (top + MENU_EST_HEIGHT > vh - MENU_GUTTER) {
      top = Math.max(MENU_GUTTER, rect.top - MENU_EST_HEIGHT - 6);
    }

    setMenuPos({ x: left, y: top });
    setMenuMode('main');
    setShowMenu(true);
  };

  const closeMenu = () => {
    setShowMenu(false);
    setMenuPos(null);
    setMenuMode('main');
  };

  const formatDate = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const preview = stripHtml(note.content || '').slice(0, 120);
  const isGrid = viewMode === 'grid';
  const noteColor = note.color;

  // ── Resolve folder info (populated object OR raw id) ───────────
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

  // ── Fixed-position menu geometry ───────────────────────────────
  const menuWidth = menuMode === 'color' ? MENU_WIDTH_COLOR : MENU_WIDTH_MAIN;

  const menuStyle = menuPos
    ? {
        position: 'fixed',
        left: Math.max(
          MENU_GUTTER,
          Math.min(menuPos.x, window.innerWidth - menuWidth - MENU_GUTTER)
        ),
        top: Math.max(
          MENU_GUTTER,
          Math.min(menuPos.y, window.innerHeight - MENU_EST_HEIGHT)
        ),
        width: menuWidth,
        maxHeight: `calc(100dvh - ${MENU_GUTTER * 2}px)`,
        zIndex: 120,
      }
    : undefined;

  const menuClassName =
    'bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 overflow-y-auto overflow-x-hidden notes-scroll';

  // ── Tiny folder badge ──────────────────────────────────────────
  const renderFolderBadge = () => {
    if (!showFolderBadge || !folderName) return null;
    return (
      <span
        className="inline-flex items-center gap-1 min-w-0 max-w-[140px] text-[10px] text-gray-400 dark:text-gray-500"
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
          className={menuItem}
        >
          <FaCheckSquare className="text-xs text-teal-500 flex-shrink-0" />
          <span>Select</span>
        </button>

        <button
          type="button"
          onClick={() => setMenuMode('color')}
          className={menuItem}
        >
          <FaPalette className="text-xs text-teal-500 flex-shrink-0" />
          <span>Color</span>
          <span className="ml-auto flex items-center gap-2 flex-shrink-0">
            {noteColor ? (
              <span
                className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: noteColor }}
              />
            ) : null}
            <FaChevronRight className="text-[9px] opacity-60" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => { onMove(note); closeMenu(); }}
          className={menuItem}
        >
          <FaFolder className="text-xs text-teal-500 flex-shrink-0" />
          <span>Move to folder…</span>
        </button>

        {note.isPublic && note.shareLink && (
          <button
            type="button"
            onClick={() => { onShareLink(note); closeMenu(); }}
            className={menuItem}
          >
            <FaShareAlt className="text-xs text-teal-500 flex-shrink-0" />
            <span>Share link</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => { onTogglePublic(note._id, !note.isPublic); closeMenu(); }}
          className={menuItem}
        >
          {note.isPublic ? (
            <FaLock className="text-xs flex-shrink-0" />
          ) : (
            <FaUnlock className="text-xs flex-shrink-0" />
          )}
          <span>{note.isPublic ? 'Make Private' : 'Make Public'}</span>
        </button>

        <button
          type="button"
          onClick={() => { onDelete(note); closeMenu(); }}
          className={menuItemDanger}
        >
          <FaTrashAlt className="text-xs flex-shrink-0" />
          <span>Delete</span>
        </button>
      </>
    );
  };

  // ── Grid variant ──────────────────────────────────────────────
  if (isGrid) {
    return (
      <div
        className={`notes-card relative bg-white dark:bg-[#131316] rounded-xl border transition cursor-pointer flex flex-col p-3 min-h-[130px] ${
          isSelected
            ? 'shadow-sm'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm'
        }`}
        style={
          isSelected
            ? { borderColor: '#14b8a6', boxShadow: '0 0 0 1px #14b8a6' }
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
            {selectionMode && <SelectionCheckbox selected={isSelected} />}
            <FaFileAlt
              className="text-sm flex-shrink-0"
              style={{ color: noteColor || '#14b8a6' }}
            />
            {note.isPublic && !selectionMode && (
              <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                Public
              </span>
            )}
          </div>

          <div
            ref={wrapperRef}
            className="flex-shrink-0 flex items-center"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {!selectionMode && (
              <button
                type="button"
                onClick={toggleMenu}
                className={`p-1 rounded-md transition ${
                  showMenu
                    ? 'text-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : 'text-gray-400 hover:text-teal-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
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
                onTouchStart={(e) => e.stopPropagation()}
              >
                {renderMenuContent()}
              </div>
            )}
          </div>
        </div>

        <h3 className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2 leading-snug">
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
      className={`notes-card bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 transition cursor-pointer relative ${
        isSelected
          ? 'bg-gray-50 dark:bg-[#1c1c20]'
          : 'hover:bg-gray-50 dark:hover:bg-[#1e1e1e]'
      }`}
      style={
        isSelected
          ? { boxShadow: 'inset 3px 0 0 #14b8a6' }
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
              <SelectionCheckbox selected={isSelected} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FaFileAlt
                className="text-sm flex-shrink-0"
                style={{ color: noteColor || '#14b8a6' }}
              />
              <h3 className="text-sm font-medium text-gray-800 dark:text-white truncate">
                {note.title || 'Untitled note'}
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
              {renderFolderBadge()}
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
        </div>

        <div
          ref={wrapperRef}
          className="flex-shrink-0 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {!selectionMode && (
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
          )}

          {showMenu && !selectionMode && (
            <div
              style={menuStyle}
              className={menuClassName}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
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
//  Main Component
// ═════════════════════════════════════════════════════════════════════
const VIEW_MODE_KEY = 'xircle.notes.viewMode';
const readViewMode = () => {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    // Grid is the default; only honor an explicit "list" preference.
    return v === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

const Notes = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const [selectedFolder, setSelectedFolder] = useState('all');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);

  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const isCreatingRef = useRef(false);

  const [promptState, setPromptState] = useState(null);
  const [folderMenu, setFolderMenu] = useState(null);

  const [viewMode, setViewMode] = useState(readViewMode);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* noop */ }
  }, [viewMode]);

  // ── Data ──────────────────────────────────────────────────────────
  const notesArg = selectedFolder === 'all' ? undefined : selectedFolder;
  const { data: notesData, isLoading } = useGetNotesQuery(notesArg);
  const { data: foldersData, isLoading: foldersLoading } = useGetNoteFoldersQuery();

  const [createNote] = useCreateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [togglePublic] = useTogglePublicMutation();
  const [moveNote] = useMoveNoteMutation();
  const [updateNoteColor] = useUpdateNoteColorMutation();
  const [createFolder] = useCreateNoteFolderMutation();
  const [updateFolder] = useUpdateNoteFolderMutation();
  const [updateFolderColor] = useUpdateNoteFolderColorMutation();
  const [deleteFolder] = useDeleteNoteFolderMutation();

  const notes = notesData?.notes || [];
  const folders = foldersData?.folders || [];
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

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

  // Show folder badge only when looking at "All Notes"
  const showFolderBadge = selectedFolder === 'all';

  // ── Selection handlers ─────────────────────────────────────────
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

  const selectAll = () => setSelectedIds(new Set(notes.map((n) => n._id)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectedCount = selectedIds.size;
  const allSelected = notes.length > 0 && selectedCount === notes.length;

  // ── Handlers ────────────────────────────────────────────────────
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

  // ── Color handlers ─────────────────────────────────────────────
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

  // ── Bulk actions ────────────────────────────────────────────────
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

  // ── Folder CRUD ─────────────────────────────────────────────────
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

  // ── Single-note move ────────────────────────────────────────────
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

  // ── Folder tree panel ──────────────────────────────────────────
  const FolderTreePanel = () => (
    <div className="flex flex-col h-full">
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
                  if (selectionMode) exitSelectionMode();
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

  // ── Loading screen ──────────────────────────────────────────────
  if (isLoading && selectedFolder === 'all') {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
          <div className="hidden md:block md:w-72 md:flex-shrink-0">
            <GeneralSidebar />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <FaSpinner className="animate-spin text-teal-500 text-3xl" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyles />

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
          <div className="flex-1 min-h-0 overflow-y-auto p-2 notes-scroll">
            <FolderTreePanel />
          </div>
        </aside>

        {/* Notes list column */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30 flex-shrink-0">
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
                    <FaCheckDouble className="text-sm text-teal-500" />
                  ) : (
                    <FaCheckSquare className="text-sm" />
                  )}
                </button>

                <button
                  onClick={() => setBulkMoveOpen(true)}
                  disabled={selectedCount === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-40 flex items-center gap-1.5"
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
                  className="md:hidden p-1.5 -ml-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Open folders"
                >
                  <FaFolderOpen className="text-sm" />
                </button>

                <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2 flex-1 min-w-0">
                  <FaFolder className="text-teal-500 text-sm hidden sm:block flex-shrink-0" />
                  <span className="truncate">{currentFolderName}</span>
                </h1>

                <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 transition ${
                      viewMode === 'list'
                        ? 'bg-gray-100 dark:bg-gray-800 text-teal-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400'
                    }`}
                    title="List view"
                    aria-label="List view"
                  >
                    <FaList className="text-xs" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 transition border-l border-gray-200 dark:border-gray-700 ${
                      viewMode === 'grid'
                        ? 'bg-gray-100 dark:bg-gray-800 text-teal-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400'
                    }`}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <FaTh className="text-xs" />
                  </button>
                </div>

                <button
                  onClick={handleCreateNote}
                  disabled={isCreatingNote}
                  className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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

          <main
            className="flex-1 min-h-0 overflow-y-auto notes-scroll"
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
            ) : viewMode === 'grid' ? (
              <div className="p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    viewMode="grid"
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(note._id)}
                    onToggleSelect={toggleSelect}
                    onEnterSelection={enterSelectionMode}
                    onClick={() => openNote(note._id)}
                    onDelete={handleDelete}
                    onTogglePublic={handleTogglePublic}
                    onShareLink={handleShareLink}
                    onMove={setMoveTarget}
                    onColorChange={handleNoteColorChange}
                    folders={folders}                    // 👈 new
                    showFolderBadge={showFolderBadge}    // 👈 new
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
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(note._id)}
                    onToggleSelect={toggleSelect}
                    onEnterSelection={enterSelectionMode}
                    onClick={() => openNote(note._id)}
                    onDelete={handleDelete}
                    onTogglePublic={handleTogglePublic}
                    onShareLink={handleShareLink}
                    onMove={setMoveTarget}
                    onColorChange={handleNoteColorChange}
                    folders={folders}                    // 👈 new
                    showFolderBadge={showFolderBadge}    // 👈 new
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
        disabled={isCreatingNote || selectionMode}
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
            <div className="flex-1 min-h-0 overflow-y-auto p-2 notes-scroll">
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
        showColor={promptState?.mode !== 'rename'}
        initialColor={null}
      />

      {/* Single-note move */}
      <FolderPickerModal
        isOpen={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        note={moveTarget}
        tree={tree}
        onMove={(folderId) => handleMove(moveTarget._id, folderId)}
        title="Move to folder"
      />

      {/* Bulk move */}
      <FolderPickerModal
        isOpen={bulkMoveOpen}
        onClose={() => !bulkBusy && setBulkMoveOpen(false)}
        note={null}
        tree={tree}
        onMove={handleBulkMove}
        title={`Move ${selectedCount} note${selectedCount === 1 ? '' : 's'}`}
        busy={bulkBusy}
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
        isOpen={bulkDeleteOpen}
        onClose={() => !bulkBusy && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Notes"
        message={`${selectedCount} note${selectedCount === 1 ? '' : 's'} will be permanently deleted. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedCount}`}
        busy={bulkBusy}
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