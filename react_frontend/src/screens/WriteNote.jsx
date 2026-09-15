// pages/WriteNote.jsx
//
// Editor: Tiptap (headless) — replaces CKEditor.
//
// Install before using this file (versions match Tiptap v3, which is what
// @tiptap/starter-kit@3.30.5 in this project already pulls in):
//
//   npm install @tiptap/react @tiptap/core @tiptap/starter-kit \
//     @tiptap/extension-subscript @tiptap/extension-superscript \
//     @tiptap/extension-text-style @tiptap/extension-highlight @tiptap/extension-text-align \
//     @tiptap/extension-image @tiptap/extension-table @tiptap/extensions
//
// Tiptap v3 restructured a few packages:
//   - StarterKit now bundles Document, Paragraph, Text, Bold, Italic, Strike,
//     Heading, BulletList, OrderedList, ListItem, ListKeymap, Underline, Link,
//     History (renamed UndoRedo), Dropcursor and Gapcursor — none of those
//     need separate packages or imports any more.
//   - Table collapsed into one package with named exports (Table, TableRow,
//     TableHeader, TableCell all from '@tiptap/extension-table').
//   - Color and FontFamily are deprecated as standalone packages — they, plus
//     FontSize and BackgroundColor, now live as named exports inside
//     '@tiptap/extension-text-style' alongside TextStyle itself. Do NOT
//     install '@tiptap/extension-color' or '@tiptap/extension-font-family'.
//   - Placeholder moved into the new '@tiptap/extensions' bundle.
// Every one of these packages now uses named exports, not a default export
// — that mismatch is what threw the "does not provide an export named
// 'default'" errors.
//
// No CSS file is imported anywhere in this file — every visual is Tailwind
// utility classes, including the editable area and every dropdown panel.

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
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

// ─── CUSTOM TIPTAP EXTENSION: resizable image ──────────────────────
// Adds a `width` attribute to the base Image node so an inserted image
// can carry a size from the toolbar without any extra markup or CSS.
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

// Anchored dropdown panel. Position is computed once, at the moment it
// opens, from the trigger button's real screen position — no observers
// watching the whole document, no DOM node shuffling. On mobile it opens
// upward (toolbar lives at the bottom, above the keyboard); on desktop it
// opens downward (toolbar lives at the top). Only one panel is ever open
// at a time, and it only closes on an outside click, Escape, or picking
// an option — nothing global is hijacked, so it can never eat a click
// meant for something else (like a modal button).
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
// On mobile the toolbar is collapsed to a single line by default; the
// overflowing buttons are clipped and hidden. A chevron button pinned at
// the extreme right toggles the strip between single-line and full
// wrapped (3-row) layout. On desktop nothing changes — everything renders
// exactly as before.
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
// Fully self-contained: owns the editor instance and both toolbar
// placements (desktop docked above the content, mobile fixed above the
// keyboard). The parent only ever sees plain HTML via onChange — no ref
// juggling, no DOM node moving, no global listeners.
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

const NoteEditor = ({ initialContent, isMobile, keyboardOffset, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
        // These node types were never exposed in the original toolbar —
        // disabled so paste/markdown shortcuts can't create content the
        // UI has no way to edit.
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
  });

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
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

// ─── MAIN COMPONENT ─────────────────────────────────────────────────
const AUTOSAVE_DELAY = 900;
const MOBILE_BREAKPOINT = 768;
const MOBILE_TOOLBAR_BASE_GAP = 110;

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

  const { data: noteData, isLoading: isFetching } = useGetNoteQuery(noteId, { skip: !noteId });
  const { data: notesData, isLoading: isNotesLoading } = useGetNotesQuery();
  const [createNote] = useCreateNoteMutation();
  const [updateNote] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [togglePublic] = useTogglePublicMutation();
  const [exportPDF] = useLazyExportNotePDFQuery();

  const notes = notesData?.notes || [];

  const loadedNoteRef = useRef(null);
  const currentNoteIdRef = useRef(noteId || null);
  const suppressAutosaveRef = useRef(true);
  const debounceRef = useRef(null);
  const sidebarRef = useRef(null);
  const dragRef = useRef(null);
  const isCreatingRef = useRef(false);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard offset via visualViewport — still needed so the mobile
  // toolbar tracks the on-screen keyboard instead of sitting under it.
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
            <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        )}

        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:inline">
          {wordCount} words · {charCount} chars
        </span>

        <SaveStatus status={isEditing ? saveStatus : 'idle'} lastSaved={lastSaved} />

        <div className="flex items-center gap-1 flex-shrink-0">
          {isEditing ? (
            <button
              onClick={handleDoneEditing}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            >
              <FaCheck className="text-xs" />
              Done
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            >
              <FaEdit className="text-xs" />
              Edit
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
              className="p-2 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Copy share link"
            >
              <FaCopy className="text-sm" />
            </button>
          )}
          <button
            onClick={handleExportPDF}
            className="p-2 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Export as PDF"
          >
            <FaFilePdf className="text-sm" />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
          >
            <FaTrashAlt className="text-sm" />
          </button>
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