// pages/WriteNote.jsx
//
// Editor: Tiptap (headless). AI features live in the same note slice —
// personalNoteApiSlice — so this file only imports from one place.
//
// AI additions:
//   • Highlight-to-ask pill over text selections (desktop + mobile)
//   • Scripture lookup (Bible / Quran) with "show more" + "full chapter"
//   • Non-scripture search results with definitions + external links
//   • Manual Bible picker — pick a book from a custom dropdown, enter
//     chapter + verse, get a 10-verse window with expand buttons
//   • Proofread and Expand actions in the header
//   • Preview-before-apply for proofread and expand — nothing saves until
//     the user hits Apply.
//
// All AI endpoints are read-only server-side; the note is only touched
// when the user accepts a suggestion and the normal autosave fires.
//
// The AI preview renders the suggested content as HTML (matching the
// editor's own output) so users see what the note will actually look
// like. Small inline fragments — change comparisons and added-section
// chips — are stripped to plain text because HTML inside them would
// break the compact list layout.

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle, Color, FontFamily, FontSize, BackgroundColor } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';

import {
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useGetNotesQuery,
  useTogglePublicMutation,
  useLazyExportNotePDFQuery,
  useLookupScriptureMutation,
  useExpandScriptureMutation,
  useSearchHighlightMutation,
  useProofreadNoteMutation,
  useCompleteNoteMutation,
} from '../slices/personalNoteApiSlice';

import toast from 'react-hot-toast';
import {
  FaFillDrip,
  FaArrowLeft,
  FaSpinner,
  FaTrashAlt,
  FaTimes,
  FaEdit,
  FaCheck,
  FaCloudUploadAlt,
  FaFileAlt,
  FaUserPlus,
  FaFile,
  FaPlus,
  FaLock,
  FaUnlock,
  FaFilePdf,
  FaCopy,
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaSubscript,
  FaSuperscript,
  FaListUl,
  FaListOl,
  FaLink,
  FaUnlink,
  FaImage,
  FaTable,
  FaUndo,
  FaRedo,
  FaPalette,
  FaHighlighter,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify,
  FaHeading,
  FaEraser,
  FaChevronDown,
  FaTrash,
  FaMagic,
  FaBookOpen,
  FaSearch,
  FaCheckDouble,
  FaExpandAlt,
  FaExternalLinkAlt,
  FaEllipsisV,
  FaChevronRight,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

// ─── HELPERS ──────────────────────────────────────────────────────────
const stripHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
};

const getWordCount = (html) => {
  const text = stripHtml(html);
  return text.trim() ? text.trim().split(/\s+/).length : 0;
};

const getCharCount = (html) => stripHtml(html).length;

// ─── BIBLE BOOKS ──────────────────────────────────────────────────────
// Canonical 66-book ordering. Used by the manual Bible picker.
const BIBLE_BOOKS = [
  {
    testament: 'Old Testament',
    books: [
      'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
      'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
      '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
      'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
      'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
      'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
      'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
      'Haggai', 'Zechariah', 'Malachi',
    ],
  },
  {
    testament: 'New Testament',
    books: [
      'Matthew', 'Mark', 'Luke', 'John', 'Acts',
      'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
      'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
      '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
      '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
      'Revelation',
    ],
  },
];

// ─── CUSTOM TIPTAP EXTENSION: resizable image ──────────────────────
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent(),
      width: {
        default: null,
        parseHTML: (element) => element.style.width || element.getAttribute('width') || null,
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { style: `width: ${attributes.width}; max-width: 100%;` };
        },
      },
    };
  },
});

const FONT_FAMILIES = [
  { label: 'Default', value: null },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
];

const FONT_SIZES = [
  { label: 'Default', value: null },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '24', value: '24px' },
  { label: '32', value: '32px' },
  { label: '48', value: '48px' },
];

const TEXT_COLORS = [
  '#111827', '#ef4444', '#f59e0b', '#eab308', '#22c55e',
  '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899',
];

const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];

const HEADING_OPTIONS = [
  { label: 'Paragraph', level: 0 },
  { label: 'Heading 1', level: 1 },
  { label: 'Heading 2', level: 2 },
  { label: 'Heading 3', level: 3 },
];

// ─── TOOLBAR PRIMITIVES ─────────────────────────────────────────────
const ToolbarButton = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-lg text-sm transition flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
      active
        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    {children}
  </button>
);

const ToolbarDivider = () => (
  <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 flex-shrink-0" />
);

const ToolbarDropdown = ({
  id,
  openId,
  setOpenId,
  isMobile,
  icon,
  label,
  active,
  width = 220,
  children,
}) => {
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [style, setStyle] = useState(null);
  const isOpen = openId === id;

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width;
    }
    if (left < margin) left = margin;

    const next = { position: 'fixed', left, width, zIndex: 70 };
    if (isMobile) {
      next.bottom = window.innerHeight - rect.top + 6;
      next.maxHeight = Math.max(160, rect.top - margin);
    } else {
      next.top = rect.bottom + 6;
      next.maxHeight = Math.max(200, window.innerHeight - rect.bottom - margin);
    }
    setStyle(next);
  }, [isOpen, isMobile, width]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpenId(null);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, setOpenId]);

  return (
    <div className="relative inline-flex flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpenId(isOpen ? null : id)}
        title={label}
        className={`p-2 rounded-lg text-sm transition flex items-center gap-1 ${
          active || isOpen
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        {icon}
        <FaChevronDown className="text-[8px] opacity-60" />
      </button>
      {isOpen && style && (
        <div
          ref={panelRef}
          style={style}
          className="overflow-y-auto bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2"
        >
          {children}
        </div>
      )}
    </div>
  );
};

const DropdownItem = ({ onClick, active, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition ${
      active
        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    {children}
  </button>
);

const ColorSwatchGrid = ({ colors, onPick, activeColor, extra }) => (
  <div>
    <div className="grid grid-cols-5 gap-1.5 mb-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          title={c}
          className={`w-7 h-7 rounded-full border-2 transition ${
            activeColor === c ? 'border-teal-500 scale-110' : 'border-gray-200 dark:border-gray-700'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
    {extra}
  </div>
);

// ─── EDITOR TOOLBAR ─────────────────────────────────────────────────
const EditorToolbar = ({ editor, isMobile }) => {
  const [openId, setOpenId] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState('');
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    if (openId === 'link') {
      setLinkUrl(editor?.getAttributes('link')?.href || '');
    }
  }, [openId, editor]);

  if (!editor) return null;

  const activeHeadingLevel = HEADING_OPTIONS.find((h) =>
    h.level === 0 ? editor.isActive('paragraph') : editor.isActive('heading', { level: h.level })
  );

  const applyLink = () => {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) url = `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setOpenId(null);
  };

  const applyImage = () => {
    if (!imageUrl.trim()) return;
    editor
      .chain()
      .focus()
      .setImage({ src: imageUrl.trim(), width: imageWidth ? `${imageWidth}px` : null })
      .run();
    setImageUrl('');
    setImageWidth('');
    setOpenId(null);
  };

  const applyTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: Math.max(1, tableRows), cols: Math.max(1, tableCols), withHeaderRow: true })
      .run();
    setOpenId(null);
  };

  const collapsed = isMobile && !mobileExpanded;

  return (
    <div className="flex items-stretch">
      <div
        className={`flex-1 min-w-0 flex items-center gap-0.5 px-2 py-1.5 ${
          collapsed ? 'flex-nowrap overflow-hidden' : 'flex-wrap'
        }`}
      >
        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <FaUndo className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <FaRedo className="text-xs" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarDropdown
          id="heading" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaHeading className="text-xs" />} label="Paragraph style" width={160}
        >
          {HEADING_OPTIONS.map((h) => (
            <DropdownItem
              key={h.label}
              active={activeHeadingLevel?.label === h.label}
              onClick={() => {
                if (h.level === 0) editor.chain().focus().setParagraph().run();
                else editor.chain().focus().toggleHeading({ level: h.level }).run();
                setOpenId(null);
              }}
            >
              {h.label}
            </DropdownItem>
          ))}
        </ToolbarDropdown>

        <ToolbarDivider />

        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <FaBold className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <FaItalic className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <FaUnderline className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <FaStrikethrough className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>
          <FaSubscript className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
          <FaSuperscript className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <FaEraser className="text-xs" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarDropdown
          id="fontFamily" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<span className="text-xs font-serif">Aa</span>} label="Font family" width={180}
        >
          {FONT_FAMILIES.map((f) => (
            <DropdownItem
              key={f.label}
              active={(editor.getAttributes('textStyle').fontFamily || null) === f.value}
              onClick={() => {
                if (f.value) editor.chain().focus().setFontFamily(f.value).run();
                else editor.chain().focus().unsetFontFamily().run();
                setOpenId(null);
              }}
            >
              <span style={{ fontFamily: f.value || 'inherit' }}>{f.label}</span>
            </DropdownItem>
          ))}
        </ToolbarDropdown>

        <ToolbarDropdown
          id="fontSize" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<span className="text-xs font-semibold">Sz</span>} label="Font size" width={110}
        >
          {FONT_SIZES.map((f) => (
            <DropdownItem
              key={f.label}
              active={(editor.getAttributes('textStyle').fontSize || null) === f.value}
              onClick={() => {
                if (f.value) editor.chain().focus().setFontSize(f.value).run();
                else editor.chain().focus().unsetFontSize().run();
                setOpenId(null);
              }}
            >
              {f.label}
            </DropdownItem>
          ))}
        </ToolbarDropdown>

        <ToolbarDropdown
          id="color" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaPalette className="text-xs" />} label="Text color" width={190}
          active={!!editor.getAttributes('textStyle').color}
        >
          <ColorSwatchGrid
            colors={TEXT_COLORS}
            activeColor={editor.getAttributes('textStyle').color}
            onPick={(c) => { editor.chain().focus().setColor(c).run(); setOpenId(null); }}
            extra={
              <DropdownItem onClick={() => { editor.chain().focus().unsetColor().run(); setOpenId(null); }}>
                Default color
              </DropdownItem>
            }
          />
        </ToolbarDropdown>

        <ToolbarDropdown
          id="background" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaFillDrip className="text-xs" />} label="Font background" width={190}
          active={!!editor.getAttributes('textStyle').backgroundColor}
        >
          <ColorSwatchGrid
            colors={HIGHLIGHT_COLORS}
            activeColor={editor.getAttributes('textStyle').backgroundColor}
            onPick={(c) => { editor.chain().focus().setBackgroundColor(c).run(); setOpenId(null); }}
            extra={
              <DropdownItem onClick={() => { editor.chain().focus().unsetBackgroundColor().run(); setOpenId(null); }}>
                Default background
              </DropdownItem>
            }
          />
        </ToolbarDropdown>

        <ToolbarDropdown
          id="highlight" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaHighlighter className="text-xs" />} label="Highlight" width={190}
          active={editor.isActive('highlight')}
        >
          <ColorSwatchGrid
            colors={HIGHLIGHT_COLORS}
            activeColor={editor.getAttributes('highlight').color}
            onPick={(c) => { editor.chain().focus().toggleHighlight({ color: c }).run(); setOpenId(null); }}
            extra={
              <DropdownItem onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpenId(null); }}>
                No highlight
              </DropdownItem>
            }
          />
        </ToolbarDropdown>

        <ToolbarDivider />

        <ToolbarDropdown
          id="align" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaAlignLeft className="text-xs" />} label="Alignment" width={150}
        >
          {[
            { value: 'left', label: 'Left', icon: <FaAlignLeft className="text-xs" /> },
            { value: 'center', label: 'Center', icon: <FaAlignCenter className="text-xs" /> },
            { value: 'right', label: 'Right', icon: <FaAlignRight className="text-xs" /> },
            { value: 'justify', label: 'Justify', icon: <FaAlignJustify className="text-xs" /> },
          ].map((a) => (
            <DropdownItem
              key={a.value}
              active={editor.isActive({ textAlign: a.value })}
              onClick={() => { editor.chain().focus().setTextAlign(a.value).run(); setOpenId(null); }}
            >
              <span className="flex items-center gap-2">{a.icon} {a.label}</span>
            </DropdownItem>
          ))}
        </ToolbarDropdown>

        <ToolbarButton title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <FaListUl className="text-xs" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <FaListOl className="text-xs" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarDropdown
          id="link" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaLink className="text-xs" />} label="Link" width={240} active={editor.isActive('link')}
        >
          <div className="space-y-2">
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyLink()}
              placeholder="https://example.com"
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-800 dark:text-white outline-none focus:border-teal-500"
            />
            <div className="flex gap-2">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyLink}
                className="flex-1 text-xs py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Apply
              </button>
              {editor.isActive('link') && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { editor.chain().focus().unsetLink().run(); setOpenId(null); }}
                  className="px-2.5 text-xs py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1"
                >
                  <FaUnlink className="text-[10px]" /> Remove
                </button>
              )}
            </div>
          </div>
        </ToolbarDropdown>

        <ToolbarDropdown
          id="image" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaImage className="text-xs" />} label="Insert image" width={240}
        >
          <div className="space-y-2">
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Image URL"
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-800 dark:text-white outline-none focus:border-teal-500"
            />
            <input
              type="number"
              value={imageWidth}
              onChange={(e) => setImageWidth(e.target.value)}
              placeholder="Width in px (optional)"
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-800 dark:text-white outline-none focus:border-teal-500"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyImage}
              className="w-full text-xs py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Insert
            </button>
          </div>
        </ToolbarDropdown>

        <ToolbarDropdown
          id="table" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaTable className="text-xs" />} label="Insert table" width={200}
          active={editor.isActive('table')}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 w-12">Rows</label>
              <input
                type="number" min={1} max={20} value={tableRows}
                onChange={(e) => setTableRows(Number(e.target.value))}
                className="flex-1 text-sm px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-800 dark:text-white outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 w-12">Cols</label>
              <input
                type="number" min={1} max={10} value={tableCols}
                onChange={(e) => setTableCols(Number(e.target.value))}
                className="flex-1 text-sm px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-800 dark:text-white outline-none focus:border-teal-500"
              />
            </div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyTable}
              className="w-full text-xs py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Insert table
            </button>
            {editor.isActive('table') && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-1.5">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  + Row
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  + Col
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  − Row
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  − Col
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { editor.chain().focus().deleteTable().run(); setOpenId(null); }}
                  className="col-span-2 text-xs py-1 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center justify-center gap-1"
                >
                  <FaTrash className="text-[10px]" /> Delete table
                </button>
              </div>
            )}
          </div>
        </ToolbarDropdown>
      </div>

      {isMobile && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMobileExpanded((v) => !v)}
          title={mobileExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
          className="flex-shrink-0 px-2.5 flex items-center border-l border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400"
        >
          <FaChevronDown
            className={`text-xs transition-transform ${mobileExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
};

// ─── TIPTAP NOTE EDITOR ─────────────────────────────────────────────
const EDITOR_CONTENT_CLASSES =
  '[&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold ' +
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 [&_li]:mb-1 ' +
  '[&_a]:text-teal-600 [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full ' +
  '[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 ' +
  '[&_th]:border [&_th]:border-gray-300 [&_th]:dark:border-gray-600 [&_th]:p-2 [&_th]:bg-gray-50 [&_th]:dark:bg-gray-800 ' +
  '[&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:p-2 [&_p]:my-2 ' +
  '[&_.is-editor-empty:first-child::before]:text-gray-400 dark:[&_.is-editor-empty:first-child::before]:text-gray-500 ' +
  '[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] ' +
  '[&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 ' +
  '[&_.is-editor-empty:first-child::before]:pointer-events-none';

const NoteEditor = ({
  initialContent,
  isMobile,
  keyboardOffset,
  onChange,
  onSelectionChange,
  onEditorReady,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      BackgroundColor,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Start writing your note...' }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[300px] text-gray-800 dark:text-gray-100 leading-relaxed',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    onSelectionUpdate: ({ editor: e }) => {
      if (!onSelectionChange) return;
      const { from, to, empty } = e.state.selection;
      if (empty) return onSelectionChange(null);
      const text = e.state.doc.textBetween(from, to, ' ').trim();
      if (!text || text.length < 2) return onSelectionChange(null);

      let rect = null;
      try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0).getBoundingClientRect();
          rect = { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
        }
      } catch {
        rect = null;
      }
      onSelectionChange({ text, rect });
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => () => editor?.destroy(), [editor]);

  return (
    <div className="ck-note-editor-wrapper">
      {!isMobile && (
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161619] sticky top-0 z-10 rounded-t-xl">
          <EditorToolbar editor={editor} isMobile={false} />
        </div>
      )}

      <div className={EDITOR_CONTENT_CLASSES}>
        <EditorContent editor={editor} />
      </div>

      {isMobile && (
        <div
          className="fixed left-0 right-0 z-20 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161619]"
          style={{ bottom: keyboardOffset }}
        >
          <EditorToolbar editor={editor} isMobile={true} />
        </div>
      )}
    </div>
  );
};

// ─── CONFIRM MODAL ──────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SIDEBAR NOTE ITEM ─────────────────────────────────────────────
const SidebarNoteItem = ({ note, isActive, onClick }) => {
  const preview = stripHtml(note.content || '').slice(0, 60);
  const formatDate = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

  return (
    <div
      onClick={() => onClick(note._id)}
      className={`px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition ${
        isActive
          ? 'bg-teal-50 dark:bg-teal-900/20 border-l-4 border-teal-500'
          : 'hover:bg-gray-50 dark:hover:bg-[#1e1e1e]'
      }`}
    >
      <div className="flex items-center gap-2">
        <FaFileAlt className="text-teal-500 text-sm flex-shrink-0" />
        <span className="text-sm font-medium text-gray-800 dark:text-white truncate flex-1">
          {note.title || 'Untitled'}
        </span>
        {note.isPublic && (
          <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
            Public
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{preview || 'Empty note'}</p>
      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-1">
        <span>{formatDate(note.updatedAt)}</span>
        {note.attachments?.length > 0 && (
          <span className="flex items-center gap-1">
            <FaFile className="text-[9px]" /> {note.attachments.length}
          </span>
        )}
        {note.collaborators?.length > 0 && (
          <span className="flex items-center gap-1">
            <FaUserPlus className="text-[9px]" /> {note.collaborators.length}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── SAVE STATUS ────────────────────────────────────────────────────
const SaveStatus = ({ status, lastSaved }) => {
  if (status === 'idle' && !lastSaved) return null;
  const map = {
    saving: { text: 'Saving…', cls: 'text-amber-500' },
    saved: { text: 'Saved', cls: 'text-teal-600 dark:text-teal-400' },
    error: { text: 'Save failed', cls: 'text-red-500' },
  };
  const s = map[status];
  return (
    <span className={`flex items-center gap-1 text-[11px] sm:text-xs ${s?.cls || 'text-gray-400'} flex-shrink-0`}>
      {status === 'saving' ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt />}
      <span className="hidden xs:inline">{s?.text || 'Saved'}</span>
      {status === 'saved' && lastSaved && (
        <span className="text-[10px] text-gray-400 hidden sm:inline">
          {formatDistanceToNow(lastSaved, { addSuffix: true })}
        </span>
      )}
    </span>
  );
};

// ═════════════════════════════════════════════════════════════════════
// BIBLE PICKER (manual lookup)
// ═════════════════════════════════════════════════════════════════════

// Custom book dropdown — no native <select>. Searchable, grouped by
// testament. The list floats over the modal body below the trigger.
const BibleBookDropdown = ({ value, onChange, isMobile }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [open]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return BIBLE_BOOKS;
    const q = search.trim().toLowerCase();
    return BIBLE_BOOKS
      .map((g) => ({ ...g, books: g.books.filter((b) => b.toLowerCase().includes(q)) }))
      .filter((g) => g.books.length > 0);
  }, [search]);

  const handlePick = (book) => {
    onChange(book);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl border text-sm transition ${
          open
            ? 'border-teal-500 ring-2 ring-teal-500/20 bg-white dark:bg-[#0f0f12]'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f12] hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        <span className={value ? 'text-gray-800 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}>
          {value || 'Select book'}
        </span>
        <FaChevronDown
          className={`text-xs text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 top-full mt-2 z-30 bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col ${
            isMobile ? 'max-h-[60vh]' : 'max-h-72'
          }`}
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const first = filteredGroups[0]?.books[0];
                    if (first) handlePick(first);
                  }
                }}
                placeholder="Search books…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-transparent focus:border-teal-500 outline-none text-gray-800 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 py-1">
            {filteredGroups.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-400">
                No books match "{search}"
              </div>
            )}
            {filteredGroups.map((group) => (
              <div key={group.testament}>
                <div className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.testament}
                </div>
                {group.books.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handlePick(b)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left transition ${
                      value === b
                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <span>{b}</span>
                    {value === b && <FaCheck className="text-teal-500 text-xs" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Number input with a big tap target and a numeric keyboard on mobile.
const NumberField = ({ label, value, onChange, min = 1, placeholder, autoFocus }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // slight delay so layout settles before focus
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const dec = () => onChange(Math.max(min, (Number(value) || min) - 1));
  const inc = () => onChange((Number(value) || 0) + 1);

  return (
    <div className="min-w-0">
      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      <div className="flex items-stretch rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f12] overflow-hidden focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition">
        <button
          type="button"
          onClick={dec}
          className="px-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm font-medium"
          tabIndex={-1}
        >
          −
        </button>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={min}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, '');
            onChange(v);
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 w-full text-center text-base font-semibold text-gray-800 dark:text-white bg-transparent outline-none py-2.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={inc}
          className="px-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm font-medium"
          tabIndex={-1}
        >
          +
        </button>
      </div>
    </div>
  );
};

// Full picker modal — bottom sheet on mobile, centered on desktop.
const BiblePickerModal = ({ open, isMobile, onClose, onSubmit, busy }) => {
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('1');

  useEffect(() => {
    if (open) {
      // keep selections between opens — user is often looking up
      // multiple passages from the same book in one session
    }
  }, [open]);

  if (!open) return null;

  const ready = Boolean(book && chapter && Number(chapter) > 0);

  const handleSubmit = () => {
    if (!ready) return;
    onSubmit({
      book,
      chapter: Number(chapter),
      verse: Number(verse) > 0 ? Number(verse) : 1,
    });
  };

  return (
    <div
      className={`fixed inset-0 z-[78] flex ${
        isMobile ? 'items-end' : 'items-center justify-center'
      } bg-black/50 backdrop-blur-sm ${isMobile ? '' : 'p-4'}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white dark:bg-[#1a1a1a] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-visible ${
          isMobile
            ? 'w-full max-h-[90vh] rounded-t-2xl'
            : 'w-full max-w-md max-h-[90vh] rounded-2xl'
        }`}
      >
        {isMobile && (
          <div className="pt-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <FaBookOpen className="text-teal-500 text-sm" />
            Bible passage
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Book
            </label>
            <BibleBookDropdown value={book} onChange={setBook} isMobile={isMobile} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Chapter"
              value={chapter}
              onChange={setChapter}
              min={1}
              placeholder="e.g. 3"
              autoFocus={Boolean(book) && !chapter}
            />
            <NumberField
              label="Start verse"
              value={verse}
              onChange={setVerse}
              min={1}
              placeholder="e.g. 2"
            />
          </div>

          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
            You'll see <strong className="text-gray-700 dark:text-gray-200">10 verses</strong> starting
            at your chosen verse. Use <strong className="text-gray-700 dark:text-gray-200">More verses</strong>{' '}
            to extend the range, or <strong className="text-gray-700 dark:text-gray-200">Full chapter</strong>{' '}
            to see everything.
          </p>
        </div>

        <div className="flex gap-2 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!ready || busy}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <FaSpinner className="animate-spin text-xs" /> : <FaBookOpen className="text-xs" />}
            Look up
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// AI COMPONENTS
// ═════════════════════════════════════════════════════════════════════

const AiSelectionPill = ({ selection, isMobile, busy, onClick }) => {
  if (!selection || busy) return null;

  let style;
  if (isMobile || !selection.rect) {
    style = {
      position: 'fixed',
      left: '50%',
      bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      transform: 'translateX(-50%)',
      zIndex: 45,
    };
  } else {
    const r = selection.rect;
    const pillH = 38;
    const above = r.top > pillH + 12;
    const top = above ? r.top - pillH - 8 : r.bottom + 8;
    const pillW = 130;
    let left = r.left + r.width / 2 - pillW / 2;
    left = Math.max(8, Math.min(window.innerWidth - pillW - 8, left));
    style = { position: 'fixed', top, left, zIndex: 45 };
  }

  return (
    <div style={style}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="flex items-center gap-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium pl-2 pr-3 py-2 rounded-full shadow-lg shadow-black/20 hover:bg-gray-800 dark:hover:bg-white transition active:scale-95"
      >
        <FaMagic className="text-teal-400 dark:text-teal-600 text-xs" />
        <span>Ask AI</span>
      </button>
    </div>
  );
};

const ScriptureView = ({ data, onExpand, expanding }) => {
  const isBible = data.type === 'bible';
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-2">
          <FaBookOpen className="text-teal-500 text-sm mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white break-words">
              {isBible ? data.reference : `${data.reference} — ${data.surahName}`}
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {isBible ? data.translation : data.edition}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-l-2 border-teal-200 dark:border-teal-900/60 pl-3">
        {isBible
          ? data.verses.map((v, i) => (
              <p key={i} className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                <span className="text-[10px] text-teal-500 font-semibold mr-1.5 align-top">
                  {v.chapter}:{v.verse}
                </span>
                {v.text}
              </p>
            ))
          : data.verses.map((v, i) => (
              <p key={i} className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                <span className="text-[10px] text-teal-500 font-semibold mr-1.5 align-top">
                  {v.surah}:{v.ayah}
                </span>
                {v.text}
              </p>
            ))}
      </div>

      {data.expandOptions?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {data.expandOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={expanding}
              onClick={() => onExpand(opt.id)}
              className="text-xs px-3 py-1.5 rounded-full border border-teal-200 dark:border-teal-900/60 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 disabled:opacity-50 flex items-center gap-1.5 transition"
            >
              {expanding ? (
                <FaSpinner className="animate-spin text-[10px]" />
              ) : (
                <FaExpandAlt className="text-[10px]" />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SearchView = ({ data }) => (
  <div className="space-y-5">
    <div className="flex items-start gap-2">
      <FaSearch className="text-teal-500 text-sm mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white break-words">
          {data.query}
        </h4>
        {data.summary && (
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 mt-2">
            {data.summary}
          </p>
        )}
      </div>
    </div>

    {data.definitions?.length > 0 && (
      <div className="space-y-2">
        <h5 className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
          Definitions
        </h5>
        <div className="space-y-1.5">
          {data.definitions.map((d, i) => (
            <div key={i} className="text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">{d.term}</span>
              <span className="text-gray-500 dark:text-gray-400"> — {d.meaning}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {data.relatedTopics?.length > 0 && (
      <div className="space-y-2">
        <h5 className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
          Related
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {data.relatedTopics.map((t, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    )}

    {data.suggestedSearches?.length > 0 && (
      <div className="space-y-2">
        <h5 className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
          Suggested searches
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {data.suggestedSearches.map((s, i) => (
            <a
              key={i}
              href={`https://www.google.com/search?q=${encodeURIComponent(s.query)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    )}

    {data.searchLinks?.length > 0 && (
      <div className="space-y-2">
        <h5 className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
          Open in
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {data.searchLinks.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5 transition"
            >
              {l.label} <FaExternalLinkAlt className="text-[9px] opacity-60" />
            </a>
          ))}
        </div>
      </div>
    )}
  </div>
);

const AiResultModal = ({ open, isMobile, onClose, loading, error, kind, data, onExpand, expanding }) => {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[75] flex ${
        isMobile ? 'items-end' : 'items-center justify-center'
      } bg-black/50 backdrop-blur-sm ${isMobile ? '' : 'p-4'}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white dark:bg-[#1a1a1a] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden ${
          isMobile
            ? 'w-full max-h-[90vh] rounded-t-2xl'
            : 'w-full max-w-2xl max-h-[85vh] rounded-2xl'
        }`}
      >
        {isMobile && (
          <div className="pt-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <FaMagic className="text-teal-500 text-xs" />
            {kind === 'scripture' ? 'Scripture' : kind === 'search' ? 'Search' : 'AI'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FaSpinner className="animate-spin text-teal-500 text-2xl" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Looking that up…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Try selecting a shorter phrase, or check the reference.
              </p>
            </div>
          )}

          {!loading && !error && kind === 'scripture' && data && (
            <ScriptureView data={data} onExpand={onExpand} expanding={expanding} />
          )}

          {!loading && !error && kind === 'search' && data && <SearchView data={data} />}
        </div>
      </div>
    </div>
  );
};

// ─── AI PREVIEW MODAL (proofread / complete) ────────────────────────
const AiPreviewModal = ({ open, isMobile, kind, result, onClose, onApply, applying }) => {
  if (!open || !result) return null;

  const isProofread = kind === 'proofread';
  const suggested = isProofread ? result.correctedContent : result.completedContent;
  const changes = isProofread ? result.changes || [] : [];
  const addedSections = !isProofread ? result.addedSections || [] : [];

  return (
    <div
      className={`fixed inset-0 z-[75] flex ${
        isMobile ? 'items-end' : 'items-center justify-center'
      } bg-black/50 backdrop-blur-sm ${isMobile ? '' : 'p-4'}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white dark:bg-[#1a1a1a] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden ${
          isMobile
            ? 'w-full max-h-[92vh] rounded-t-2xl'
            : 'w-full max-w-2xl max-h-[88vh] rounded-2xl'
        }`}
      >
        {isMobile && (
          <div className="pt-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            {isProofread ? (
              <FaCheckDouble className="text-teal-500 text-xs" />
            ) : (
              <FaMagic className="text-teal-500 text-xs" />
            )}
            {isProofread ? 'Proofread suggestion' : 'Expanded version'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isProofread && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
              {result.changeCount > 0
                ? `${result.changeCount} fix${result.changeCount === 1 ? '' : 'es'} suggested.`
                : 'No changes suggested.'}
              {result.summary ? ` ${result.summary}` : ''}
            </div>
          )}
          {!isProofread && result.rationale && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
              {result.rationale}
            </div>
          )}

          {isProofread && changes.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                Changes
              </h5>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {changes.map((c, i) => (
                  <div key={i} className="text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 break-words">
                    <span className="text-gray-500 dark:text-gray-400 mr-1.5">[{c.type}]</span>
                    <span className="line-through text-red-500/80">
                      {stripHtml(c.original) || c.original}
                    </span>
                    <span className="mx-1.5 text-gray-400">→</span>
                    <span className="text-teal-600 dark:text-teal-400">
                      {stripHtml(c.corrected) || c.corrected}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isProofread && addedSections.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                Added
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {addedSections.map((s, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300"
                  >
                    {stripHtml(s.heading) || s.heading || s.type}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h5 className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
              Preview
            </h5>
            <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 bg-white dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-72 overflow-y-auto">
              <div
                className={
                  'prose prose-sm max-w-none dark:prose-invert ' +
                  '[&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold ' +
                  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 ' +
                  '[&_p]:my-2 [&_a]:text-teal-600 [&_a]:underline ' +
                  '[&_strong]:font-semibold [&_em]:italic [&_u]:underline ' +
                  '[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 ' +
                  '[&_th]:border [&_th]:border-gray-300 [&_th]:dark:border-gray-600 [&_th]:p-2 ' +
                  '[&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:p-2'
                }
                dangerouslySetInnerHTML={{ __html: suggested || '' }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={applying}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={applying}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {applying ? <FaSpinner className="animate-spin text-xs" /> : <FaCheck className="text-xs" />}
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const AiActionsMenu = ({ disabled, busy, onProofread, onComplete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="AI actions"
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-teal-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? <FaSpinner className="text-sm animate-spin" /> : <FaMagic className="text-sm" />}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1.5 min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onProofread(); }}
            className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FaCheckDouble className="text-teal-500 text-xs mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-800 dark:text-white">Proofread</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                Fix spelling, punctuation, grammar
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onComplete(); }}
            className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FaExpandAlt className="text-teal-500 text-xs mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-800 dark:text-white">Expand</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                Add explanation, depth, context
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

const SmallScreenActions = ({ isPublic, hasShareLink, onCopyShareLink, onExportPDF, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative sm:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        title="More actions"
      >
        <FaEllipsisV className="text-sm" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1.5 min-w-[180px]">
          {isPublic && hasShareLink && (
            <button
              type="button"
              onClick={() => { setOpen(false); onCopyShareLink(); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition text-xs text-gray-700 dark:text-gray-300"
            >
              <FaCopy className="text-xs" /> Copy share link
            </button>
          )}
          <button
            type="button"
            onClick={() => { setOpen(false); onExportPDF(); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition text-xs text-gray-700 dark:text-gray-300"
          >
            <FaFilePdf className="text-xs" /> Export as PDF
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition text-xs text-red-600"
          >
            <FaTrashAlt className="text-xs" /> Delete note
          </button>
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────
const AUTOSAVE_DELAY = 900;
const MOBILE_BREAKPOINT = 768;
const MOBILE_TOOLBAR_BASE_GAP = 110;
const MANUAL_VERSE_WINDOW = 10;   // verses shown per fetch
const MANUAL_VERSE_STEP   = 10;   // added each "More verses" click

const WriteNote = () => {
  const { id: noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isEditing, setIsEditing] = useState(Boolean(location.state?.justCreated));
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSaved, setLastSaved] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [editorKey, setEditorKey] = useState(noteId || 'pending');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // ── AI state ─────────────────────────────────────────────────────
  const [aiSelection, setAiSelection] = useState(null);   // { text, rect }
  const [aiPanel, setAiPanel] = useState(null);           // { loading, error, kind, data, expanding, manualRef? }
  const [aiPreview, setAiPreview] = useState(null);       // { kind, result }
  const [aiBusy, setAiBusy] = useState(null);             // 'proofread' | 'complete'
  const [aiApplying, setAiApplying] = useState(false);
  const [showBiblePicker, setShowBiblePicker] = useState(false);

  // ── Note hooks (CRUD + AI, same slice) ───────────────────────────
  const { data: noteData, isLoading: isFetching } = useGetNoteQuery(noteId, { skip: !noteId });
  const { data: notesData, isLoading: isNotesLoading } = useGetNotesQuery();
  const [createNote] = useCreateNoteMutation();
  const [updateNote] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [togglePublic] = useTogglePublicMutation();
  const [exportPDF] = useLazyExportNotePDFQuery();

  const [lookupScripture] = useLookupScriptureMutation();
  const [expandScripture] = useExpandScriptureMutation();
  const [searchHighlight] = useSearchHighlightMutation();
  const [proofreadNoteApi] = useProofreadNoteMutation();
  const [completeNoteApi] = useCompleteNoteMutation();

  const notes = notesData?.notes || [];

  const loadedNoteRef = useRef(null);
  const currentNoteIdRef = useRef(noteId || null);
  const suppressAutosaveRef = useRef(true);
  const debounceRef = useRef(null);
  const sidebarRef = useRef(null);
  const dragRef = useRef(null);
  const isCreatingRef = useRef(false);
  const editorRef = useRef(null);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard offset via visualViewport
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) {
      setKeyboardOffset(0);
      return;
    }
    const vv = window.visualViewport;
    const updateOffset = () => {
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardOffset(offset > 0 ? Math.round(offset) : 0);
    };
    updateOffset();
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    return () => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
    };
  }, [isMobile]);

  // Hide the selection pill when the user scrolls
  useEffect(() => {
    if (!aiSelection) return;
    const clear = () => setAiSelection(null);
    window.addEventListener('scroll', clear, true);
    return () => window.removeEventListener('scroll', clear, true);
  }, [aiSelection]);

  // Sidebar resizing
  const startResize = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
      if (newWidth > 150 && newWidth < 500) {
        setSidebarWidth(newWidth);
      }
    };
    const onMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    } else {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  // Create new note
  const handleCreateNote = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreatingNote(true);
    try {
      const result = await createNote({ title: 'Untitled', content: '' }).unwrap();
      navigate(`/notes/${result.note._id}`, { state: { justCreated: true } });
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create note');
    } finally {
      isCreatingRef.current = false;
      setIsCreatingNote(false);
    }
  }, [createNote, navigate]);

  // Route change
  useEffect(() => {
    setIsEditing(Boolean(location.state?.justCreated));
    currentNoteIdRef.current = noteId || null;
    setAiSelection(null);
    setAiPanel(null);
    setAiPreview(null);
    setShowBiblePicker(false);
  }, [noteId]);

  // Load note data
  useEffect(() => {
    if (!noteId) return;

    if (noteData?.note && loadedNoteRef.current !== noteData.note._id) {
      suppressAutosaveRef.current = true;
      setTitle(noteData.note.title || '');
      const html = noteData.note.content || '';
      setContent(html);
      setIsPublic(noteData.note.isPublic || false);
      setSaveStatus('idle');
      setLastSaved(noteData.note.updatedAt ? new Date(noteData.note.updatedAt) : null);
      setWordCount(getWordCount(html));
      setCharCount(getCharCount(html));
      loadedNoteRef.current = noteData.note._id;
      currentNoteIdRef.current = noteData.note._id;
      setEditorKey(noteData.note._id);
    }
  }, [noteData, noteId]);

  // Persist
  const persist = useCallback(async () => {
    if (!currentNoteIdRef.current) return;
    setSaveStatus('saving');
    try {
      const payload = { title: (title || 'Untitled').trim(), content: content || '', isPublic };
      await updateNote({ noteId: currentNoteIdRef.current, data: payload }).unwrap();
      setLastSaved(new Date());
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      toast.error(err?.data?.message || 'Failed to save note');
    }
  }, [title, content, isPublic, updateNote]);

  // Autosave
  useEffect(() => {
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false;
      return;
    }
    if (!isEditing) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persist();
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(debounceRef.current);
  }, [title, content, isPublic, isEditing, persist]);

  // Handlers
  const handleDoneEditing = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist();
    setIsEditing(false);
    setAiSelection(null);
  };

  const handleDelete = async () => {
    if (!currentNoteIdRef.current) return;
    try {
      await deleteNote(currentNoteIdRef.current).unwrap();
      toast.success('Note deleted');
      navigate('/notes');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete note');
    }
  };

  const handleNoteSelect = (id) => {
    if (id === noteId) return;
    navigate(`/notes/${id}`);
  };

  const handleTogglePublic = async () => {
    if (!currentNoteIdRef.current) return;
    try {
      const newStatus = !isPublic;
      await togglePublic({ noteId: currentNoteIdRef.current, isPublic: newStatus }).unwrap();
      setIsPublic(newStatus);
      toast.success(newStatus ? 'Note is now public' : 'Note is now private');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update public status');
    }
  };

  const handleExportPDF = async () => {
    if (!currentNoteIdRef.current) return;
    try {
      const blob = await exportPDF(currentNoteIdRef.current).unwrap();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Note-${title || 'Untitled'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };

  const handleCopyShareLink = () => {
    const shareLink = noteData?.note?.shareLink;
    if (shareLink) {
      const url = `${window.location.origin}/share/${shareLink}`;
      navigator.clipboard?.writeText(url).then(() => {
        toast.success('Share link copied to clipboard');
      }).catch(() => toast.error('Failed to copy link'));
    } else {
      toast.error('No share link available');
    }
  };

  const handleEditorChange = (html) => {
    suppressAutosaveRef.current = false;
    setContent(html);
    setWordCount(getWordCount(html));
    setCharCount(getCharCount(html));
  };

  // ── AI HANDLERS ────────────────────────────────────────────────

  const handleSelectionChange = useCallback((info) => {
    if (aiPanel || aiPreview) return;
    setAiSelection(info);
  }, [aiPanel, aiPreview]);

  const handleEditorReady = useCallback((ed) => {
    editorRef.current = ed;
  }, []);

  // ── Bible passage lookup ───────────────────────────────────────
  // Builds a reference string like "Matthew 3:2-12" and pushes it
  // through the same lookupScripture endpoint the highlight flow uses,
  // so the response shape is identical.
  const runBibleLookup = useCallback(async ({ book, chapter, verseStart, verseEnd }) => {
    const refString =
      verseEnd && verseEnd > verseStart
        ? `${book} ${chapter}:${verseStart}-${verseEnd}`
        : `${book} ${chapter}:${verseStart}`;

    setAiPanel({ loading: true, kind: null, data: null, error: null, expanding: false });

    try {
      const { result } = await lookupScripture({ text: refString }).unwrap();

      // Detect whether the returned range already spans to the end of
      // the chapter — if so, we hide "more verses".
      const lastVerse = result.verses?.[result.verses.length - 1]?.verse ?? verseEnd;
      const hitChapterEnd = verseEnd != null && lastVerse < verseEnd;

      const expandOptions = [];
      if (!hitChapterEnd) {
        expandOptions.push({ id: 'more_verses', label: 'Show more verses' });
      }
      expandOptions.push({
        id: 'full_chapter',
        label: `Show full ${book} ${chapter}`,
      });

      setAiPanel({
        loading: false,
        kind: 'scripture',
        data: { ...result, expandOptions },
        error: null,
        expanding: false,
        manualRef: {
          book,
          chapter,
          verseStart,
          verseEnd: lastVerse ?? verseEnd,
        },
      });
    } catch (err) {
      setAiPanel({
        loading: false,
        kind: null,
        data: null,
        error: err?.data?.message || 'Could not load that passage right now.',
        expanding: false,
      });
    }
  }, [lookupScripture]);

  const handleBibleLookupSubmit = useCallback(({ book, chapter, verse }) => {
    setShowBiblePicker(false);
    const verseStart = verse;
    const verseEnd = verse + MANUAL_VERSE_WINDOW;
    runBibleLookup({ book, chapter, verseStart, verseEnd });
  }, [runBibleLookup]);

  const handleManualExpand = useCallback(async (mode) => {
    if (!aiPanel?.manualRef) return;
    const ref = aiPanel.manualRef;

    let nextStart = ref.verseStart;
    let nextEnd;
    if (mode === 'full_chapter') {
      nextStart = 1;
      nextEnd = 999; // server clamps at end of chapter
    } else {
      nextEnd = (ref.verseEnd || ref.verseStart) + MANUAL_VERSE_STEP;
    }

    setAiPanel((p) => ({ ...p, expanding: true }));
    try {
      const refString =
        mode === 'full_chapter'
          ? `${ref.book} ${ref.chapter}`
          : `${ref.book} ${ref.chapter}:${nextStart}-${nextEnd}`;

      const { result } = await lookupScripture({ text: refString }).unwrap();

      const lastVerse = result.verses?.[result.verses.length - 1]?.verse ?? nextEnd;
      const hitChapterEnd = mode === 'full_chapter' ? true : lastVerse < nextEnd;

      const expandOptions = [];
      if (!hitChapterEnd) {
        expandOptions.push({ id: 'more_verses', label: 'Show more verses' });
      }
      if (mode !== 'full_chapter') {
        expandOptions.push({
          id: 'full_chapter',
          label: `Show full ${ref.book} ${ref.chapter}`,
        });
      }

      setAiPanel({
        loading: false,
        kind: 'scripture',
        data: { ...result, expandOptions },
        error: null,
        expanding: false,
        manualRef: {
          ...ref,
          verseStart: nextStart,
          verseEnd: lastVerse,
        },
      });
    } catch (err) {
      toast.error(err?.data?.message || 'Could not expand the passage.');
      setAiPanel((p) => ({ ...p, expanding: false }));
    }
  }, [aiPanel, lookupScripture]);

  // ── Highlight-to-ask flow ──────────────────────────────────────
  const handleAskAiAboutSelection = async () => {
    if (!aiSelection?.text) return;
    const text = aiSelection.text;
    setAiSelection(null);

    try { editorRef.current?.commands.blur(); } catch { /* noop */ }

    setAiPanel({ loading: true, kind: null, data: null, error: null, expanding: false });

    try {
      const { result } = await lookupScripture({
        text,
        noteId: currentNoteIdRef.current || undefined,
      }).unwrap();

      if (result.type === 'bible' || result.type === 'quran') {
        setAiPanel({ loading: false, kind: 'scripture', data: result, error: null, expanding: false });
        return;
      }

      const { result: searchResult } = await searchHighlight({
        text,
        noteId: currentNoteIdRef.current || undefined,
      }).unwrap();

      setAiPanel({ loading: false, kind: 'search', data: searchResult, error: null, expanding: false });
    } catch (err) {
      setAiPanel({
        loading: false,
        kind: null,
        data: null,
        error: err?.data?.message || 'Could not look that up right now.',
        expanding: false,
      });
    }
  };

  // Expand handler used by ScriptureView — dispatches based on origin.
  const handleExpandScripture = async (expandMode) => {
    if (!aiPanel?.data) return;

    // Manual picker → custom range expansion, client-driven.
    if (aiPanel.manualRef) {
      return handleManualExpand(expandMode);
    }

    // AI-detected → server-driven expansion.
    const { type, parsed } = aiPanel.data;
    setAiPanel((p) => ({ ...p, expanding: true }));
    try {
      const { result } = await expandScripture({ type, parsed, expand: expandMode }).unwrap();
      setAiPanel({ loading: false, kind: 'scripture', data: result, error: null, expanding: false });
    } catch (err) {
      toast.error(err?.data?.message || 'Could not expand the passage.');
      setAiPanel((p) => ({ ...p, expanding: false }));
    }
  };

  const handleProofread = async () => {
    if (!currentNoteIdRef.current) return;
    setAiBusy('proofread');
    try {
      const { result } = await proofreadNoteApi({
        noteId: currentNoteIdRef.current,
      }).unwrap();
      setAiPreview({ kind: 'proofread', result });
    } catch (err) {
      toast.error(err?.data?.message || 'Proofreading failed.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleComplete = async () => {
    if (!currentNoteIdRef.current) return;
    setAiBusy('complete');
    try {
      const { result } = await completeNoteApi({
        noteId: currentNoteIdRef.current,
        style: 'explanatory',
      }).unwrap();
      setAiPreview({ kind: 'complete', result });
    } catch (err) {
      toast.error(err?.data?.message || 'Expansion failed.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleApplyAiPreview = async () => {
    if (!aiPreview || !editorRef.current) return;
    setAiApplying(true);
    try {
      const newContent = aiPreview.kind === 'proofread'
        ? aiPreview.result.correctedContent
        : aiPreview.result.completedContent;

      try {
        editorRef.current.commands.setContent(newContent, { emitUpdate: true });
      } catch {
        editorRef.current.commands.setContent(newContent);
      }
      handleEditorChange(editorRef.current.getHTML());

      setAiPreview(null);
      toast.success(aiPreview.kind === 'proofread' ? 'Fixes applied' : 'Expansion applied');
    } catch (err) {
      toast.error('Failed to apply suggestion.');
    } finally {
      setAiApplying(false);
    }
  };

  // Loading
  if (isFetching || isNotesLoading || !noteId) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0f0f12]">
        <FaSpinner className="animate-spin text-teal-500 text-3xl" />
      </div>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <div
      ref={sidebarRef}
      className="h-full bg-white dark:bg-[#131316] border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FaFileAlt className="text-teal-500" /> Notes
        </h2>
        <button
          onClick={handleCreateNote}
          disabled={isCreatingNote}
          className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreatingNote ? (
            <FaSpinner className="text-sm animate-spin" />
          ) : (
            <FaPlus className="text-sm" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4">
            <FaFileAlt className="text-2xl mb-1 opacity-30" />
            <p className="text-xs">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <SidebarNoteItem
              key={note._id}
              note={note}
              isActive={note._id === currentNoteIdRef.current}
              onClick={handleNoteSelect}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderHeader = () => (
    <div className="flex-shrink-0 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f12]">
      <div className="px-3 sm:px-6 py-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => navigate('/notes')}
          className="md:hidden p-2 -ml-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition flex-shrink-0"
        >
          <FaArrowLeft className="text-sm" />
        </button>

        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-lg sm:text-xl font-semibold text-gray-800 dark:text-white placeholder-gray-400"
            autoFocus
          />
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white truncate">
              {title || 'Untitled Note'}
            </h1>
            <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 hidden xs:inline">
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        )}

        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:inline">
          {wordCount} words · {charCount} chars
        </span>

        <SaveStatus status={isEditing ? saveStatus : 'idle'} lastSaved={lastSaved} />

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Bible passage picker — always available, useful while
              reading a note that already contains a reference too. */}
          <button
            type="button"
            onClick={() => setShowBiblePicker(true)}
            title="Look up a Bible passage"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-teal-500 transition"
          >
            <FaBookOpen className="text-sm" />
          </button>

          {isEditing && (
            <AiActionsMenu
              disabled={!isEditing}
              busy={aiBusy}
              onProofread={handleProofread}
              onComplete={handleComplete}
            />
          )}

          {isEditing ? (
            <button
              onClick={handleDoneEditing}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            >
              <FaCheck className="text-xs" />
              <span className="hidden xs:inline">Done</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            >
              <FaEdit className="text-xs" />
              <span className="hidden xs:inline">Edit</span>
            </button>
          )}

          <button
            onClick={handleTogglePublic}
            className={`p-2 rounded-lg transition ${
              isPublic ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={isPublic ? 'Make private' : 'Make public'}
          >
            {isPublic ? <FaUnlock className="text-sm" /> : <FaLock className="text-sm" />}
          </button>

          {isPublic && noteData?.note?.shareLink && (
            <button
              onClick={handleCopyShareLink}
              className="hidden sm:inline-flex p-2 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Copy share link"
            >
              <FaCopy className="text-sm" />
            </button>
          )}

          <button
            onClick={handleExportPDF}
            className="hidden sm:inline-flex p-2 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Export as PDF"
          >
            <FaFilePdf className="text-sm" />
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="hidden sm:inline-flex p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            title="Delete note"
          >
            <FaTrashAlt className="text-sm" />
          </button>

          <SmallScreenActions
            isPublic={isPublic}
            hasShareLink={Boolean(noteData?.note?.shareLink)}
            onCopyShareLink={handleCopyShareLink}
            onExportPDF={handleExportPDF}
            onDelete={() => setShowDeleteModal(true)}
          />
        </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="flex-1 flex flex-col overflow-hidden w-full relative">
      <div className="flex-1 overflow-y-auto w-full">
        <div
          className="w-full px-3 sm:px-6 py-6"
          style={
            isMobile && isEditing
              ? { paddingBottom: keyboardOffset + MOBILE_TOOLBAR_BASE_GAP }
              : undefined
          }
        >
          {!isEditing && (
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
              <div
                className="[&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 [&_li]:mb-1 [&_a]:text-teal-600 [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full [&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_td]:border [&_td]:border-gray-300 [&_td]:p-2"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          )}
          {isEditing && (
            <NoteEditor
              key={editorKey}
              initialContent={content}
              isMobile={isMobile}
              keyboardOffset={keyboardOffset}
              onChange={handleEditorChange}
              onSelectionChange={handleSelectionChange}
              onEditorReady={handleEditorReady}
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-white dark:bg-[#0f0f12] flex overflow-hidden">
      <div className="hidden md:flex flex-shrink-0 h-full relative">
        {renderSidebar()}
        <div
          ref={dragRef}
          onMouseDown={startResize}
          className="w-1 cursor-col-resize hover:bg-teal-500/50 transition-colors absolute right-0 top-0 bottom-0 z-10"
        />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0">
        {renderHeader()}
        {renderEditor()}
      </div>

      {/* ── AI surfaces ─────────────────────────────────────────── */}
      <AiSelectionPill
        selection={aiSelection}
        isMobile={isMobile}
        busy={Boolean(aiPanel?.loading)}
        onClick={handleAskAiAboutSelection}
      />

      <BiblePickerModal
        open={showBiblePicker}
        isMobile={isMobile}
        busy={Boolean(aiPanel?.loading)}
        onClose={() => setShowBiblePicker(false)}
        onSubmit={handleBibleLookupSubmit}
      />

      <AiResultModal
        open={Boolean(aiPanel)}
        isMobile={isMobile}
        loading={Boolean(aiPanel?.loading)}
        error={aiPanel?.error || null}
        kind={aiPanel?.kind || null}
        data={aiPanel?.data || null}
        expanding={Boolean(aiPanel?.expanding)}
        onExpand={handleExpandScripture}
        onClose={() => setAiPanel(null)}
      />

      <AiPreviewModal
        open={Boolean(aiPreview)}
        isMobile={isMobile}
        kind={aiPreview?.kind}
        result={aiPreview?.result}
        applying={aiApplying}
        onApply={handleApplyAiPreview}
        onClose={() => setAiPreview(null)}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Note"
        message="This note will be permanently deleted. This action cannot be undone."
      />
    </div>
  );
};

export default WriteNote;