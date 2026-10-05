// pages/WriteNote.jsx
//
// Editor: Tiptap (headless). AI features live in the same note slice —
// personalNoteApiSlice — so this file only imports from one place.
//
// FEATURE GATING:
//   The Bible picker, the AI actions menu, and the highlight-to-ask pill
//   are all hidden unless the user has enabled them from /extensions:
//       user.isAiEnabled     → proofread / expand / rewrite / search
//       user.isBibleEnabled  → Bible picker + Bible scripture lookups
//       user.isQuranEnabled  → Quran scripture lookups (via selection pill)
//
//   The Extensions button in the header is ALWAYS visible so any user can
//   go flip these on.
//
// TABLES:
//   • Columns are resizable by dragging the borders (Tiptap native).
//   • Rows are resizable by dragging the grip on the left of any row.
//   • Edit and view modes share the exact same CSS + classes.
//
// CALLOUTS:
//   • A block container with a rounded box, tinted bg, colored accent bar,
//     and an emoji icon in the corner (Slack / Notion style).
//   • Wrap any block (or selection of blocks) via the 💡 toolbar dropdown.
//   • Customizable icon, background, accent bar, and text color.
//   • Round-trips through save/load as <div data-callout …>.
//   • Backspace at start of empty callout unwraps it.
//   • Mod-Enter exits a callout.
//
// EDIT == VIEW PARITY:
//   All spacing/rhythm lives in NOTE_RICH_CSS. Edit and view modes mount
//   the exact same `.note-content` element so both share every rule.
//   No Tailwind arbitrary selectors are used for spacing.

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state';
import { CellSelection, selectionCell } from '@tiptap/pm/tables';
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
  useLookupScriptureMutation,
  useExpandScriptureMutation,
  useSearchHighlightMutation,
  useProofreadNoteMutation,
  useCompleteNoteMutation,
  useRewriteNoteMutation,
} from '../slices/personalNoteApiSlice';

import toast from 'react-hot-toast';
import {
  FaFillDrip, FaArrowLeft, FaSpinner, FaTrashAlt, FaTimes, FaEdit, FaCheck,
  FaCloudUploadAlt, FaFileAlt, FaUserPlus, FaFile, FaPlus, FaLock, FaUnlock,
  FaFilePdf, FaCopy, FaBold, FaItalic, FaUnderline, FaStrikethrough,
  FaSubscript, FaSuperscript, FaListUl, FaListOl, FaLink, FaUnlink, FaImage,
  FaTable, FaUndo, FaRedo, FaPalette, FaHighlighter, FaAlignLeft, FaAlignCenter,
  FaAlignRight, FaAlignJustify, FaHeading, FaEraser, FaChevronDown, FaTrash,
  FaMagic, FaBookOpen, FaSearch, FaCheckDouble, FaExpandAlt, FaExternalLinkAlt,
  FaEllipsisV, FaChevronRight, FaFeather, FaPuzzlePiece, FaPaintBrush,
  FaObjectGroup, FaObjectUngroup, FaRegLightbulb, FaGripLines,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

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

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? (result.split(',')[1] || '') : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// ─── COLOR HELPERS ───────────────────────────────────────────────────
const parseColor = (str) => {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const h = m[1];
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const h = m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
};

const toHex = (str, fallback = '#ffffff') => {
  const c = parseColor(str);
  if (!c) return fallback;
  return '#' + c.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
};

const contrastText = (bg) => {
  const c = parseColor(bg);
  if (!c) return null;
  const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return lum > 0.6 ? '#111827' : '#ffffff';
};

// ─── SHARED TABLE + CALLOUT CSS ──────────────────────────────────────
const buildTableCss = (S, { dark = true } = {}) => `
${S} {
  --tb-def-border: #d1d5db;
  --tb-def-head-bg: #f3f4f6;
  --tb-def-head-color: #111827;
  --tb-def-stripe: rgba(0, 0, 0, 0.04);
}
${
  dark
    ? `.dark ${S} {
  --tb-def-border: #3f3f46;
  --tb-def-head-bg: #27272a;
  --tb-def-head-color: #f4f4f5;
  --tb-def-stripe: rgba(255, 255, 255, 0.05);
}`
    : ''
}
${S} .tableWrapper { overflow-x: auto; }
${S} table {
  border-collapse: collapse;
  table-layout: fixed;
  max-width: 100%;
  margin: 12px 0;
  border: var(--tb-bw, 1px) var(--tb-bs, solid) var(--tb-border, var(--tb-def-border));
  color: var(--tb-color, inherit);
}
${S} table[data-align="left"] { margin-left: 0; margin-right: auto; }
${S} table[data-align="center"] { margin-left: auto; margin-right: auto; }
${S} table[data-align="right"] { margin-left: auto; margin-right: 0; }
${S} td,
${S} th {
  border: var(--tb-bw, 1px) var(--tb-bs, solid) var(--tb-border, var(--tb-def-border));
  padding: 8px 10px;
  vertical-align: top;
  text-align: left;
  position: relative;
  box-sizing: border-box;
  min-width: 0;
  overflow-wrap: anywhere;
  background-color: var(--tb-bg, transparent);
  color: var(--tb-color, inherit);
}
${S} th {
  background-color: var(--tb-head-bg, var(--tb-def-head-bg));
  color: var(--tb-head-color, var(--tb-def-head-color));
  font-weight: 600;
}
${S} table[data-density="compact"] td,
${S} table[data-density="compact"] th { padding: 4px 6px; }
${S} table[data-density="roomy"] td,
${S} table[data-density="roomy"] th { padding: 14px 16px; }
${S} table[data-striped="true"] tbody tr:nth-child(even) td {
  background-image: linear-gradient(
    var(--tb-stripe, var(--tb-def-stripe)),
    var(--tb-stripe, var(--tb-def-stripe))
  );
}
${S} td p,
${S} th p { margin: 4px 0; }
${S} td > :first-child,
${S} th > :first-child { margin-top: 0; }
${S} td > :last-child,
${S} th > :last-child { margin-bottom: 0; }
${S} td ul, ${S} td ol, ${S} th ul, ${S} th ol { margin: 2px 0; }
${S} .selectedCell::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(20, 184, 166, 0.22);
  pointer-events: none;
  z-index: 2;
}
${S} .column-resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: -2px;
  width: 4px;
  z-index: 20;
  background-color: #14b8a6;
  pointer-events: none;
}
${S} .resize-cursor { cursor: col-resize; }
`;

const buildCalloutCss = (S, { dark = true } = {}) => `
${S} {
  --callout-def-bg: #f0fdfa;
  --callout-def-border: #14b8a6;
  --callout-def-text: #0f172a;
}
${
  dark
    ? `.dark ${S} {
  --callout-def-bg: #042f2e;
  --callout-def-border: #14b8a6;
  --callout-def-text: #d1faf5;
}`
    : ''
}
${S} [data-callout] {
  position: relative;
  margin: 14px 0;
  padding: 12px 16px 12px 48px;
  border-radius: 8px;
  background-color: var(--callout-bg, var(--callout-def-bg));
  border-left: 4px solid var(--callout-border, var(--callout-def-border));
  color: var(--callout-color, var(--callout-def-text));
  transition: box-shadow 120ms ease;
}
${S} [data-callout]::before {
  content: attr(data-icon);
  position: absolute;
  left: 14px;
  top: 12px;
  font-size: 18px;
  line-height: 1.2;
  pointer-events: none;
  user-select: none;
}
${S} [data-callout] > :first-child { margin-top: 0; }
${S} [data-callout] > :last-child { margin-bottom: 0; }
${S} [data-callout] p { margin: 0.35rem 0; }
${S} [data-callout] p:first-child { margin-top: 0; }
${S} [data-callout] p:last-child { margin-bottom: 0; }
${S} [data-callout].ProseMirror-selectednode {
  outline: 2px solid #14b8a6;
  outline-offset: 2px;
}
${S} [data-callout].is-empty-hint::after {
  content: 'Empty callout — type here…';
  color: rgba(20, 184, 166, 0.55);
  pointer-events: none;
  position: absolute;
  left: 48px;
  top: 12px;
}
`;

// ─── SHARED NOTE CONTENT CSS (identical for edit + view + PDF) ──────
const NOTE_RICH_CSS = `
.note-rich { line-height: 1.6; }

.note-rich .note-content {
  outline: none;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  line-height: 1.6;
  color: inherit;
}

.note-rich .note-content p {
  margin: 0.5rem 0;
  line-height: 1.6;
}
.note-rich .note-content > p:first-child { margin-top: 0; }
.note-rich .note-content > p:last-child  { margin-bottom: 0; }
.note-rich .note-content p:empty::after {
  content: '\\200B';
  display: inline;
}

.note-rich .note-content ul,
.note-rich .note-content ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.note-rich .note-content ul { list-style: disc; }
.note-rich .note-content ol { list-style: decimal; }
.note-rich .note-content li {
  margin: 0.125rem 0;
  line-height: 1.6;
}
.note-rich .note-content li > p,
.note-rich .note-content li > p:first-child,
.note-rich .note-content li > p:last-child {
  margin: 0;
}

.note-rich .note-content h1 {
  font-size: 1.875rem; font-weight: 700; line-height: 1.3;
  margin: 1.25rem 0 0.5rem;
}
.note-rich .note-content h2 {
  font-size: 1.5rem; font-weight: 700; line-height: 1.3;
  margin: 1rem 0 0.5rem;
}
.note-rich .note-content h3 {
  font-size: 1.25rem; font-weight: 600; line-height: 1.3;
  margin: 0.875rem 0 0.5rem;
}
.note-rich .note-content h1:first-child,
.note-rich .note-content h2:first-child,
.note-rich .note-content h3:first-child { margin-top: 0; }

.note-rich .note-content a {
  color: #0d9488;
  text-decoration: underline;
}
.note-rich .note-content img {
  max-width: 100%;
  border-radius: 0.5rem;
}

.note-rich .ProseMirror {
  white-space: normal;
  min-height: 220px;
}
` + buildTableCss('.note-rich') + buildCalloutCss('.note-rich');

// ─── PDF EXPORT ──────────────────────────────────────────────────────
const PDF_SCOPED_CSS =
  `
  [data-pdf-root] { background: #ffffff; color: #111827; }
  [data-pdf-root] h1 { font-size: 18pt; font-weight: 700; line-height: 1.3; margin: 14pt 0 6pt 0; }
  [data-pdf-root] h2 { font-size: 15pt; font-weight: 700; line-height: 1.3; margin: 12pt 0 6pt 0; }
  [data-pdf-root] h3 { font-size: 13pt; font-weight: 600; line-height: 1.3; margin: 10pt 0 5pt 0; }
  [data-pdf-root] p { margin: 6pt 0; }
  [data-pdf-root] ul { list-style: disc outside; padding-left: 20pt; margin: 6pt 0; }
  [data-pdf-root] ol { list-style: decimal outside; padding-left: 20pt; margin: 6pt 0; }
  [data-pdf-root] li { margin: 2pt 0; }
  [data-pdf-root] li > p { margin: 0; }
  [data-pdf-root] a { color: #0d9488; text-decoration: underline; }
  [data-pdf-root] strong, [data-pdf-root] b { font-weight: 700; }
  [data-pdf-root] em, [data-pdf-root] i { font-style: italic; }
  [data-pdf-root] u { text-decoration: underline; }
  [data-pdf-root] s, [data-pdf-root] del { text-decoration: line-through; }
  [data-pdf-root] sub { vertical-align: sub; font-size: 75%; line-height: 0; }
  [data-pdf-root] sup { vertical-align: super; font-size: 75%; line-height: 0; }
  [data-pdf-root] img { max-width: 100%; height: auto; display: block; margin: 8pt auto; }
` +
  buildTableCss('[data-pdf-root]', { dark: false }) +
  buildCalloutCss('[data-pdf-root]', { dark: false });

const generatePdfFromNote = async (title, contentHtml) => {
  const [html2canvasMod, jspdfMod] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  const html2canvas = html2canvasMod.default || html2canvasMod;
  const JsPDF = jspdfMod.jsPDF || jspdfMod.default;

  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-pdf-style', 'true');
  styleEl.textContent = PDF_SCOPED_CSS;
  document.head.appendChild(styleEl);

  const container = document.createElement('div');
  container.setAttribute('data-pdf-root', 'true');
  Object.assign(container.style, {
    position: 'fixed', left: '-10000px', top: '0',
    width: '190mm', padding: '0', boxSizing: 'border-box',
    background: '#ffffff', color: '#111827',
    fontFamily: 'Georgia, "Times New Roman", "Iowan Old Style", serif',
    fontSize: '11pt', lineHeight: '1.6',
  });

  const titleEl = document.createElement('h1');
  titleEl.textContent = title || 'Untitled Note';
  Object.assign(titleEl.style, {
    fontSize: '22pt', fontWeight: '700', margin: '0 0 6pt 0',
    textAlign: 'center', color: '#111827',
  });
  container.appendChild(titleEl);

  const meta = document.createElement('p');
  meta.textContent = `Exported from Xircle · ${new Date().toLocaleString()}`;
  Object.assign(meta.style, {
    fontSize: '9pt', color: '#6b7280',
    textAlign: 'center', margin: '0 0 18pt 0',
  });
  container.appendChild(meta);

  const body = document.createElement('div');
  body.innerHTML = contentHtml || '';
  container.appendChild(body);

  document.body.appendChild(container);

  try {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => new Promise((resolve) => {
      if (img.complete) return resolve();
      img.onload = () => resolve();
      img.onerror = () => resolve();
    })));

    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
    });

    const PAGE_W_MM = 210, PAGE_H_MM = 297;
    const MARGIN_TOP = 12, MARGIN_BOTTOM = 14, MARGIN_SIDE = 10;
    const contentW = PAGE_W_MM - MARGIN_SIDE * 2;
    const contentH = PAGE_H_MM - MARGIN_TOP - MARGIN_BOTTOM;
    const pxPerMm = canvas.width / contentW;
    const pageHeightPx = Math.floor(contentH * pxPerMm);

    const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let offsetY = 0, pageIndex = 0;
    while (offsetY < canvas.height) {
      const sliceH = Math.min(pageHeightPx, canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', MARGIN_SIDE, MARGIN_TOP, contentW, sliceH / pxPerMm);

      offsetY += sliceH;
      pageIndex += 1;
    }

    return pdf.output('blob');
  } finally {
    if (container.parentNode) document.body.removeChild(container);
    if (styleEl.parentNode) document.head.removeChild(styleEl);
  }
};

// ─── BIBLE BOOKS ──────────────────────────────────────────────────────
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

// ─── TIPTAP EXTENSIONS ──────────────────────────────────────────────
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

const tableVarAttr = (cssVar) => ({
  default: null,
  parseHTML: (el) => (el.style && el.style.getPropertyValue(cssVar)?.trim()) || null,
});

const CustomTable = Table.extend({
  addAttributes() {
    const withVar = (name, cssVar) => ({
      ...tableVarAttr(cssVar),
      renderHTML: (attrs) => (attrs[name] ? { style: `${cssVar}: ${attrs[name]};` } : {}),
    });
    return {
      ...(this.parent?.() || {}),
      tableWidth: {
        default: '100%',
        parseHTML: (el) => el.style?.width || '100%',
        renderHTML: (attrs) => ({ style: `width: ${attrs.tableWidth || '100%'};` }),
      },
      tableAlign: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-align') || 'left',
        renderHTML: (attrs) => ({ 'data-align': attrs.tableAlign || 'left' }),
      },
      density: {
        default: 'normal',
        parseHTML: (el) => el.getAttribute('data-density') || 'normal',
        renderHTML: (attrs) =>
          attrs.density && attrs.density !== 'normal' ? { 'data-density': attrs.density } : {},
      },
      striped: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-striped') === 'true',
        renderHTML: (attrs) => (attrs.striped ? { 'data-striped': 'true' } : {}),
      },
      borderColor: withVar('borderColor', '--tb-border'),
      borderStyle: withVar('borderStyle', '--tb-bs'),
      borderWidth: withVar('borderWidth', '--tb-bw'),
      cellBg: withVar('cellBg', '--tb-bg'),
      textColor: withVar('textColor', '--tb-color'),
      headerBg: withVar('headerBg', '--tb-head-bg'),
      headerColor: withVar('headerColor', '--tb-head-color'),
      stripeColor: withVar('stripeColor', '--tb-stripe'),
    };
  },
});

const CustomTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      rowHeight: {
        default: null,
        parseHTML: (el) => el.style?.height || null,
        renderHTML: (attrs) =>
          attrs.rowHeight ? { style: `height: ${attrs.rowHeight};` } : {},
      },
    };
  },
});

const cellExtraAttributes = () => ({
  cellBg: {
    default: null,
    parseHTML: (el) => el.style?.backgroundColor || null,
    renderHTML: (attrs) => (attrs.cellBg ? { style: `background-color: ${attrs.cellBg};` } : {}),
  },
  cellColor: {
    default: null,
    parseHTML: (el) => el.style?.color || null,
    renderHTML: (attrs) => (attrs.cellColor ? { style: `color: ${attrs.cellColor};` } : {}),
  },
  cellVAlign: {
    default: null,
    parseHTML: (el) => el.style?.verticalAlign || null,
    renderHTML: (attrs) => (attrs.cellVAlign ? { style: `vertical-align: ${attrs.cellVAlign};` } : {}),
  },
});

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return { ...(this.parent?.() || {}), ...cellExtraAttributes() };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...(this.parent?.() || {}), ...cellExtraAttributes() };
  },
});

// ─── CALLOUT NODE ───────────────────────────────────────────────────
// Block container with rounded box, tinted bg, colored accent bar, and
// an emoji icon. Persists as <div data-callout …>.
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      bgColor: {
        default: null,
        parseHTML: (el) => {
          const v = el.style?.getPropertyValue('--callout-bg')?.trim();
          return v || null;
        },
        renderHTML: (attrs) =>
          attrs.bgColor ? { style: `--callout-bg: ${attrs.bgColor};` } : {},
      },
      borderColor: {
        default: null,
        parseHTML: (el) => {
          const v = el.style?.getPropertyValue('--callout-border')?.trim();
          return v || null;
        },
        renderHTML: (attrs) =>
          attrs.borderColor ? { style: `--callout-border: ${attrs.borderColor};` } : {},
      },
      textColor: {
        default: null,
        parseHTML: (el) => {
          const v = el.style?.getPropertyValue('--callout-color')?.trim();
          return v || null;
        },
        renderHTML: (attrs) =>
          attrs.textColor ? { style: `--callout-color: ${attrs.textColor};` } : {},
      },
      icon: {
        default: '💡',
        parseHTML: (el) => el.getAttribute('data-icon') || '💡',
        renderHTML: (attrs) => ({ 'data-icon': attrs.icon || '💡' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': 'true' }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (attrs = {}) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs = {}) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
      updateCallout:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-c': () => this.editor.commands.toggleCallout(),
      // Exit a callout at the end of its last block.
      'Mod-Enter': () => {
        if (!this.editor.isActive(this.name)) return false;
        return this.editor
          .chain()
          .command(({ tr, state, dispatch }) => {
            const { $from } = state.selection;
            let calloutDepth = -1;
            for (let d = $from.depth; d > 0; d--) {
              if ($from.node(d).type.name === this.name) { calloutDepth = d; break; }
            }
            if (calloutDepth === -1) return false;
            const calloutPos = $from.after(calloutDepth);
            const paragraph = state.schema.nodes.paragraph.create();
            if (dispatch) tr.insert(calloutPos, paragraph);
            return true;
          })
          .run();
      },
      // Backspace at the very start of the first empty paragraph unwraps.
      Backspace: () => {
        if (!this.editor.isActive(this.name)) return false;
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        let calloutDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === this.name) { calloutDepth = d; break; }
        }
        if (calloutDepth === -1) return false;

        const calloutStart = $from.before(calloutDepth) + 1;
        if ($from.pos !== calloutStart + 1) return false;

        const calloutNode = $from.node(calloutDepth);
        // If the only child is an empty paragraph, unwrap.
        if (calloutNode.childCount === 1 && calloutNode.firstChild.content.size === 0) {
          return this.editor.commands.unsetCallout();
        }
        return false;
      },
    };
  },
});

// Ensures there's always an editable paragraph below a trailing table/callout.
const EnsureTrailingParagraph = Extension.create({
  name: 'ensureTrailingParagraph',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('ensureTrailingParagraph'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((t) => t.docChanged)) return null;
          const last = newState.doc.lastChild;
          if (last && (last.type.name === 'table' || last.type.name === 'callout')) {
            const paragraph = newState.schema.nodes.paragraph;
            if (!paragraph) return null;
            return newState.tr.insert(newState.doc.content.size, paragraph.create());
          }
          return null;
        },
      }),
    ];
  },
});

// ─── TABLE HELPERS ───────────────────────────────────────────────────
const getTableInfo = (editor) => {
  if (!editor || editor.isDestroyed) return null;
  try {
    const { $from } = editor.state.selection;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type.name === 'table') return { node: n, pos: $from.before(d) };
    }
  } catch { /* noop */ }
  return null;
};

const setTableAttrs = (editor, attrs) => {
  const info = getTableInfo(editor);
  if (!info) return;
  const tr = editor.state.tr.setNodeMarkup(info.pos, undefined, {
    ...info.node.attrs, ...attrs,
  });
  editor.view.dispatch(tr);
};

const getCurrentCellAttrs = (editor) => {
  try {
    const $cell = selectionCell(editor.state);
    return $cell?.nodeAfter?.attrs || {};
  } catch { return {}; }
};

const applyCellAttrs = (editor, scope, attrs) => {
  if (!editor || !getTableInfo(editor)) return;
  const { state, view } = editor;
  const original = state.selection.toJSON();
  try {
    if (scope === 'row' || scope === 'column') {
      const $cell = selectionCell(state);
      if (!$cell) return;
      const sel =
        scope === 'row'
          ? CellSelection.rowSelection($cell)
          : CellSelection.colSelection($cell);
      view.dispatch(state.tr.setSelection(sel));
    }
    Object.entries(attrs).forEach(([key, value]) => {
      editor.commands.setCellAttribute(key, value);
    });
  } finally {
    if (scope !== 'cell') {
      try {
        view.dispatch(
          editor.state.tr.setSelection(Selection.fromJSON(editor.state.doc, original))
        );
      } catch { /* noop */ }
    }
  }
};

const selectCellDom = (editor, cell) => {
  try {
    const pos = editor.view.posAtDOM(cell, 0);
    const $pos = editor.state.doc.resolve(pos);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near($pos)));
    return true;
  } catch { return false; }
};

const getScrollParent = (el) => {
  let p = el?.parentElement;
  while (p) {
    const oy = window.getComputedStyle(p).overflowY;
    if (oy === 'auto' || oy === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
};

// ─── CONSTANTS ──────────────────────────────────────────────────────
const TABLE_COLORS = [
  '#ffffff', '#f3f4f6', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8',
  '#fed7aa', '#e9d5ff', '#111827', '#0d9488', '#1d4ed8', '#dc2626',
];

const TABLE_STYLE_RESET = {
  borderColor: null, borderStyle: null, borderWidth: null,
  cellBg: null, textColor: null, headerBg: null, headerColor: null,
  striped: false, stripeColor: null,
};

const TABLE_PRESETS = [
  { id: 'default', label: 'Default', attrs: {} },
  { id: 'teal', label: 'Teal', attrs: { borderColor: '#99f6e4', headerBg: '#0d9488', headerColor: '#ffffff', cellBg: '#ffffff', textColor: '#111827', striped: true, stripeColor: '#f0fdfa' } },
  { id: 'ocean', label: 'Ocean', attrs: { borderColor: '#bfdbfe', headerBg: '#1d4ed8', headerColor: '#ffffff', cellBg: '#ffffff', textColor: '#111827', striped: true, stripeColor: '#eff6ff' } },
  { id: 'night', label: 'Night', attrs: { borderColor: '#3f3f46', headerBg: '#09090b', headerColor: '#fafafa', cellBg: '#18181b', textColor: '#e4e4e7', striped: true, stripeColor: '#232326' } },
  { id: 'sunny', label: 'Sunny', attrs: { borderColor: '#fcd34d', headerBg: '#f59e0b', headerColor: '#111827', cellBg: '#fffbeb', textColor: '#451a03', striped: true, stripeColor: '#fef3c7' } },
  { id: 'rose', label: 'Rose', attrs: { borderColor: '#fda4af', headerBg: '#e11d48', headerColor: '#ffffff', cellBg: '#fff1f2', textColor: '#4c0519', striped: true, stripeColor: '#ffe4e6' } },
  { id: 'bold', label: 'Bold grid', attrs: { borderColor: '#111827', borderWidth: '2px', headerBg: '#e5e7eb', headerColor: '#111827', cellBg: '#ffffff', textColor: '#111827' } },
  { id: 'dashed', label: 'Dashed', attrs: { borderColor: '#9ca3af', borderStyle: 'dashed', headerBg: '#fef9c3', headerColor: '#111827', cellBg: '#ffffff', textColor: '#111827' } },
];

const CALLOUT_BG_COLORS = [
  '#f0fdfa', '#eff6ff', '#fffbeb', '#fef2f2', '#f0fdf4',
  '#faf5ff', '#f5f3ff', '#fdf4ff', '#f9fafb', '#111827',
];
const CALLOUT_BORDER_COLORS = [
  '#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#22c55e',
  '#a855f7', '#8b5cf6', '#ec4899', '#6b7280', '#0f172a',
];
const CALLOUT_TEXT_COLORS = [
  '#0f172a', '#1e293b', '#111827', '#0d9488', '#1d4ed8',
  '#dc2626', '#b45309', '#7c3aed', '#db2777', '#ffffff',
];
const CALLOUT_ICONS = ['💡', 'ℹ️', '⚠️', '✅', '❌', '📝', '🔥', '⭐', '🎯', '📌', '❓', '🚀'];

const CALLOUT_PRESETS = [
  { id: 'idea',    label: 'Idea',    icon: '💡', bgColor: '#f0fdfa', borderColor: '#14b8a6', textColor: '#0f172a' },
  { id: 'info',    label: 'Info',    icon: 'ℹ️', bgColor: '#eff6ff', borderColor: '#3b82f6', textColor: '#0f172a' },
  { id: 'warning', label: 'Warning', icon: '⚠️', bgColor: '#fffbeb', borderColor: '#f59e0b', textColor: '#451a03' },
  { id: 'success', label: 'Success', icon: '✅', bgColor: '#f0fdf4', borderColor: '#22c55e', textColor: '#052e16' },
  { id: 'danger',  label: 'Danger',  icon: '❌', bgColor: '#fef2f2', borderColor: '#ef4444', textColor: '#450a0a' },
  { id: 'note',    label: 'Note',    icon: '📝', bgColor: '#f9fafb', borderColor: '#6b7280', textColor: '#111827' },
];

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
  { label: '12', value: '12px' }, { label: '14', value: '14px' },
  { label: '16', value: '16px' }, { label: '18', value: '18px' },
  { label: '24', value: '24px' }, { label: '32', value: '32px' },
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

const REWRITE_STYLES = [
  { value: 'explanatory', label: 'Explanatory', hint: 'Define terms, add examples' },
  { value: 'formal', label: 'Formal', hint: 'Professional tone' },
  { value: 'casual', label: 'Casual', hint: 'Friendly and direct' },
  { value: 'devotional', label: 'Devotional', hint: 'Reflective, warm' },
  { value: 'academic', label: 'Academic', hint: 'Precise, structured' },
  { value: 'journal', label: 'Journal', hint: 'First-person reflection' },
];

const REWRITE_LENGTHS = [
  { value: 'shorter', label: 'Shorter', hint: '~50-70% of original' },
  { value: 'same', label: 'Same', hint: 'Roughly same length' },
  { value: 'longer', label: 'Longer', hint: '~130-180% of original' },
  { value: 'much_longer', label: 'Much longer', hint: '~200-300% of original' },
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

const ToolbarDropdown = ({ id, openId, setOpenId, isMobile, icon, label, active, width = 220, children }) => {
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [style, setStyle] = useState(null);
  const isOpen = openId === id;

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    let left = rect.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
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
    const handleKey = (e) => { if (e.key === 'Escape') setOpenId(null); };
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

// ─── TABLE SETTINGS UI ──────────────────────────────────────────────
const SegButtons = ({ options, value, onChange }) => (
  <div className="flex gap-1">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        title={o.title || o.label}
        onClick={() => onChange(o.value)}
        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition flex items-center justify-center ${
          value === o.value
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        {o.icon || o.label}
      </button>
    ))}
  </div>
);

const PanelField = ({ label, children }) => (
  <div>
    <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</div>
    {children}
  </div>
);

const ColorRow = ({ label, value, onChange, palette = TABLE_COLORS }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="text-[10px] text-gray-400 hover:text-red-500 transition"
      >
        Reset
      </button>
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      {palette.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full border-2 transition ${
            value && toHex(value, '') === c
              ? 'border-teal-500 scale-110'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
      <label
        title="Custom color"
        className="relative w-5 h-5 rounded-full overflow-hidden border-2 border-dashed border-gray-400 dark:border-gray-500 cursor-pointer"
        style={value ? { backgroundColor: toHex(value) } : undefined}
      >
        <input
          type="color"
          value={toHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {!value && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500">
            +
          </span>
        )}
      </label>
    </div>
  </div>
);

const StructBtn = ({ label, onClick, disabled, danger, icon }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed ${
      danger
        ? 'border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    {icon}
    {label}
  </button>
);

const TableSettingsPanel = ({ editor }) => {
  const [tab, setTab] = useState('design');
  const [scope, setScope] = useState('cell');

  const info = getTableInfo(editor);
  if (!info) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">
        Click inside a table to customize it.
      </p>
    );
  }

  const a = info.node.attrs;
  const cellAttrs = getCurrentCellAttrs(editor);
  const set = (attrs) => setTableAttrs(editor, attrs);
  const widthPct = parseInt(a.tableWidth, 10) || 100;
  const borderStyle = a.borderStyle || 'solid';
  const borderWidth = parseInt(a.borderWidth, 10) || 1;

  const run = (name) => () => editor.chain().focus()[name]().run();
  const can = (name) => { try { return Boolean(editor.can()[name]()); } catch { return false; } };

  const tabs = [
    { id: 'design', label: 'Design' },
    { id: 'borders', label: 'Borders' },
    { id: 'layout', label: 'Layout' },
    { id: 'cells', label: 'Cells' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/70">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition ${
              tab === t.id
                ? 'bg-white dark:bg-[#26262b] text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'design' && (
        <div className="space-y-4">
          <PanelField label="Presets">
            <div className="grid grid-cols-4 gap-2">
              {TABLE_PRESETS.map((p) => {
                const border = p.attrs.borderColor || '#d1d5db';
                const head = p.attrs.headerBg || '#e5e7eb';
                const body = p.attrs.cellBg || '#ffffff';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set({ ...TABLE_STYLE_RESET, ...p.attrs })}
                    className="group text-center"
                    title={p.label}
                  >
                    <div
                      className="rounded-md overflow-hidden group-hover:ring-2 ring-teal-500 transition"
                      style={{ border: `1.5px ${p.attrs.borderStyle || 'solid'} ${border}` }}
                    >
                      <div style={{ height: 8, background: head }} />
                      <div style={{ height: 6, background: body }} />
                      <div
                        style={{
                          height: 6,
                          background: p.attrs.striped ? p.attrs.stripeColor : body,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </PanelField>

          <ColorRow
            label="Header background"
            value={a.headerBg}
            onChange={(v) => set({ headerBg: v, headerColor: v ? contrastText(v) : null })}
          />
          <ColorRow
            label="Header text color"
            value={a.headerColor}
            onChange={(v) => set({ headerColor: v })}
          />
          <ColorRow
            label="Body background"
            value={a.cellBg}
            onChange={(v) => set({ cellBg: v, textColor: v ? contrastText(v) : null })}
          />
          <ColorRow
            label="Body text color"
            value={a.textColor}
            onChange={(v) => set({ textColor: v })}
          />

          <PanelField label="Striped rows">
            <SegButtons
              value={a.striped ? 'on' : 'off'}
              onChange={(v) => set({ striped: v === 'on' })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on', label: 'On' },
              ]}
            />
          </PanelField>
          {a.striped && (
            <ColorRow
              label="Stripe color"
              value={a.stripeColor}
              onChange={(v) => set({ stripeColor: v })}
            />
          )}
        </div>
      )}

      {tab === 'borders' && (
        <div className="space-y-4">
          <ColorRow
            label="Border color"
            value={a.borderColor}
            onChange={(v) => set({ borderColor: v })}
          />
          <PanelField label="Border style">
            <div className="grid grid-cols-3 gap-1">
              {['solid', 'dashed', 'dotted', 'double', 'none'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    set({
                      borderStyle: s === 'solid' ? null : s,
                      ...(s === 'double' && borderWidth < 3 ? { borderWidth: '3px' } : {}),
                    })
                  }
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border capitalize transition ${
                    borderStyle === s
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </PanelField>
          <PanelField label="Border thickness">
            <SegButtons
              value={borderWidth}
              onChange={(v) => set({ borderWidth: v === 1 ? null : `${v}px` })}
              options={[1, 2, 3, 4, 6].map((n) => ({ value: n, label: `${n}px` }))}
            />
          </PanelField>
          <button
            type="button"
            onClick={() => set({ borderColor: null, borderStyle: null, borderWidth: null })}
            className="w-full py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Reset borders
          </button>
        </div>
      )}

      {tab === 'layout' && (
        <div className="space-y-4">
          <PanelField label={`Table width — ${widthPct}%`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => set({ tableWidth: `${Math.max(20, widthPct - 5)}%` })}
                className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
                title="Smaller"
              >
                −
              </button>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={widthPct}
                onChange={(e) => set({ tableWidth: `${e.target.value}%` })}
                className="flex-1 accent-teal-600"
              />
              <button
                type="button"
                onClick={() => set({ tableWidth: `${Math.min(100, widthPct + 5)}%` })}
                className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
                title="Bigger"
              >
                +
              </button>
            </div>
          </PanelField>

          <PanelField label="Position">
            <SegButtons
              value={a.tableAlign || 'left'}
              onChange={(v) => set({ tableAlign: v })}
              options={[
                { value: 'left', title: 'Left', icon: <FaAlignLeft className="text-xs" /> },
                { value: 'center', title: 'Center', icon: <FaAlignCenter className="text-xs" /> },
                { value: 'right', title: 'Right', icon: <FaAlignRight className="text-xs" /> },
              ]}
            />
          </PanelField>

          <PanelField label="Cell spacing">
            <SegButtons
              value={a.density || 'normal'}
              onChange={(v) => set({ density: v })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'normal', label: 'Normal' },
                { value: 'roomy', label: 'Roomy' },
              ]}
            />
          </PanelField>

          <PanelField label="Rows & columns">
            <div className="grid grid-cols-2 gap-1.5">
              <StructBtn label="Row above" onClick={run('addRowBefore')} disabled={!can('addRowBefore')} />
              <StructBtn label="Row below" onClick={run('addRowAfter')} disabled={!can('addRowAfter')} />
              <StructBtn label="Column left" onClick={run('addColumnBefore')} disabled={!can('addColumnBefore')} />
              <StructBtn label="Column right" onClick={run('addColumnAfter')} disabled={!can('addColumnAfter')} />
              <StructBtn danger label="Delete row" onClick={run('deleteRow')} disabled={!can('deleteRow')} />
              <StructBtn danger label="Delete column" onClick={run('deleteColumn')} disabled={!can('deleteColumn')} />
              <StructBtn
                label="Merge cells"
                icon={<FaObjectGroup className="text-[10px]" />}
                onClick={run('mergeCells')}
                disabled={!can('mergeCells')}
              />
              <StructBtn
                label="Split cell"
                icon={<FaObjectUngroup className="text-[10px]" />}
                onClick={run('splitCell')}
                disabled={!can('splitCell')}
              />
              <StructBtn label="Header row" onClick={run('toggleHeaderRow')} disabled={!can('toggleHeaderRow')} />
              <StructBtn label="Header column" onClick={run('toggleHeaderColumn')} disabled={!can('toggleHeaderColumn')} />
            </div>
            <button
              type="button"
              onClick={run('deleteTable')}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <FaTrash className="text-[10px]" /> Delete table
            </button>
          </PanelField>

          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Tip: drag the border between two columns to resize a column. Drag
            the grip on the left of a row to change its height.
          </p>
        </div>
      )}

      {tab === 'cells' && (
        <div className="space-y-4">
          <PanelField label="Apply to">
            <SegButtons
              value={scope}
              onChange={setScope}
              options={[
                { value: 'cell', label: 'Cell' },
                { value: 'row', label: 'Whole row' },
                { value: 'column', label: 'Whole column' },
              ]}
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
              Tip: drag across several cells to style just those.
            </p>
          </PanelField>

          <ColorRow
            label="Cell background"
            value={cellAttrs.cellBg}
            onChange={(v) =>
              applyCellAttrs(editor, scope, {
                cellBg: v,
                cellColor: v ? contrastText(v) : null,
              })
            }
          />
          <ColorRow
            label="Cell text color"
            value={cellAttrs.cellColor}
            onChange={(v) => applyCellAttrs(editor, scope, { cellColor: v })}
          />

          <PanelField label="Vertical alignment">
            <SegButtons
              value={cellAttrs.cellVAlign || 'top'}
              onChange={(v) =>
                applyCellAttrs(editor, scope, { cellVAlign: v === 'top' ? null : v })
              }
              options={[
                { value: 'top', label: 'Top' },
                { value: 'middle', label: 'Middle' },
                { value: 'bottom', label: 'Bottom' },
              ]}
            />
          </PanelField>

          <button
            type="button"
            onClick={() =>
              applyCellAttrs(editor, scope, { cellBg: null, cellColor: null, cellVAlign: null })
            }
            className="w-full py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Clear cell styling
          </button>
        </div>
      )}
    </div>
  );
};

const TableSettingsSheet = ({ editor, isMobile, keyboardOffset, onClose }) => (
  <div
    data-table-ui
    onMouseDown={(e) => {
      const tag = e.target?.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') e.preventDefault();
    }}
    className={`fixed z-[65] bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col ${
      isMobile
        ? 'left-0 right-0 rounded-t-2xl max-h-[46vh]'
        : 'right-4 top-24 w-[310px] rounded-2xl max-h-[calc(100vh-8rem)]'
    }`}
    style={isMobile ? { bottom: keyboardOffset + 48 } : undefined}
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
        <FaTable className="text-teal-500 text-xs" />
        Table settings
      </h4>
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <FaTimes className="text-sm" />
      </button>
    </div>
    <div className="overflow-y-auto p-4">
      <TableSettingsPanel editor={editor} />
    </div>
  </div>
);

// ─── TABLE OVERLAY ──────────────────────────────────────────────────
const BarBtn = ({ onClick, title, active, danger, disabled, children }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`flex-shrink-0 min-w-[28px] h-7 px-1.5 rounded-lg text-xs flex items-center justify-center gap-1 transition disabled:opacity-30 disabled:cursor-not-allowed ${
      active
        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
        : danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    {children}
  </button>
);

const BarDivider = () => (
  <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5 flex-shrink-0" />
);

const TableOverlay = ({
  editor, hoverCell, isMobile, keyboardOffset, panelOpen, onTogglePanel, wrapperRef,
}) => {
  const [, force] = useReducer((x) => x + 1, 0);
  const [rowDrag, setRowDrag] = useState(null);
  const rowDragRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => force());
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, []);

  const beginRowDrag = (rowEl, e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = rowEl.getBoundingClientRect();
    const state = { rowEl, startY: e.clientY, startHeight: rect.height };
    rowDragRef.current = state;
    setRowDrag(state);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!rowDrag) return;
    const onMove = (e) => {
      const delta = e.clientY - rowDrag.startY;
      const newH = Math.max(28, rowDrag.startHeight + delta);
      rowDrag.rowEl.style.height = `${newH}px`;
    };
    const onUp = () => {
      const finalH = rowDrag.rowEl.style.height;
      const rowEl = rowDrag.rowEl;
      rowEl.style.height = '';
      try {
        const pos = editor.view.posAtDOM(rowEl, 0);
        const $pos = editor.state.doc.resolve(pos);
        for (let d = $pos.depth; d > 0; d--) {
          const n = $pos.node(d);
          if (n.type.name === 'tableRow') {
            const rowPos = $pos.before(d);
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(rowPos, undefined, {
                ...n.attrs,
                rowHeight: finalH || null,
              })
            );
            break;
          }
        }
      } catch { /* noop */ }
      rowDragRef.current = null;
      setRowDrag(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [rowDrag, editor]);

  if (!editor || editor.isDestroyed) return null;

  let activeCell = null;
  const info = getTableInfo(editor);
  if (info) {
    try {
      const $c = selectionCell(editor.state);
      const dom = $c ? editor.view.nodeDOM($c.pos) : null;
      if (dom && dom.nodeType === 1) activeCell = dom;
    } catch { activeCell = null; }
  }

  let hover = null;
  try {
    if (hoverCell && hoverCell.isConnected && editor.view.dom.contains(hoverCell)) hover = hoverCell;
  } catch { hover = null; }

  const target = hover || activeCell;
  if (!target) return null;
  const table = target.closest('table');
  if (!table) return null;

  const wrapper = wrapperRef.current;
  const tbEl = wrapper?.querySelector('[data-editor-toolbar]');
  const tb = tbEl ? tbEl.getBoundingClientRect() : null;
  const scroller = getScrollParent(wrapper);
  const sr = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  const minY = isMobile ? sr.top : Math.max(sr.top, tb ? tb.bottom : sr.top);
  const maxY = isMobile ? Math.min(sr.bottom, tb ? tb.top : sr.bottom) : sr.bottom;

  const tRect = table.getBoundingClientRect();
  if (tRect.bottom < minY || tRect.top > maxY) return null;

  const runOnCell = (cell, cmd) => {
    if (!selectCellDom(editor, cell)) return;
    editor.chain().focus()[cmd]().run();
  };

  const addRowEnd = () => {
    const rows = table.rows;
    const last = rows[rows.length - 1];
    const cell = last?.cells[last.cells.length - 1];
    if (cell) runOnCell(cell, 'addRowAfter');
  };

  const addColEnd = () => {
    const first = table.rows[0];
    const cell = first?.cells[first.cells.length - 1];
    if (cell) runOnCell(cell, 'addColumnAfter');
  };

  const rowBarTop = tRect.bottom + 3;
  const showRowBar = rowBarTop >= minY && rowBarTop + 16 <= maxY;
  const colBarLeft = Math.min(tRect.right + 3, window.innerWidth - 18);
  const colBarTop = Math.max(tRect.top, minY);
  const colBarHeight = Math.min(tRect.bottom, maxY) - colBarTop;
  const showColBar = colBarHeight > 20;

  const row = target.parentElement;
  const rowRect = row ? row.getBoundingClientRect() : null;
  const cellRect = target.getBoundingClientRect();
  const rowIdx = row ? Array.from(table.rows).indexOf(row) : -1;
  const colIdx = target.cellIndex;

  const rowHandles = [];
  if (rowRect) {
    if (rowIdx === 0) rowHandles.push({ y: rowRect.top, cmd: 'addRowBefore', title: 'Add row above' });
    rowHandles.push({ y: rowRect.bottom, cmd: 'addRowAfter', title: 'Add row below' });
  }
  const colHandles = [];
  if (colIdx === 0) colHandles.push({ x: cellRect.left, cmd: 'addColumnBefore', title: 'Add column left' });
  colHandles.push({ x: cellRect.right, cmd: 'addColumnAfter', title: 'Add column right' });

  const handleClass =
    'fixed z-[15] w-5 h-5 rounded-full bg-teal-600 text-white shadow-md shadow-black/20 flex items-center justify-center hover:scale-110 active:scale-95 transition';

  let bar = null;
  if (activeCell && info) {
    const aTable = activeCell.closest('table');
    const ar = aTable ? aTable.getBoundingClientRect() : null;
    if (ar && !(ar.bottom < minY || ar.top > maxY)) {
      let barTop = ar.top - 44;
      if (barTop < minY + 4) barTop = ar.bottom + 24;
      if (barTop > maxY - 44) barTop = Math.max(minY + 4, Math.min(ar.top + 6, maxY - 44));
      const barLeft = Math.max(8, Math.min(ar.left, window.innerWidth - 340));
      const widthPct = parseInt(info.node.attrs.tableWidth, 10) || 100;
      const align = info.node.attrs.tableAlign || 'left';
      const run = (name) => () => editor.chain().focus()[name]().run();
      const canDo = (name) => { try { return Boolean(editor.can()[name]()); } catch { return false; } };
      bar = (
        <div
          data-table-ui
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-[16] flex items-center gap-0.5 p-1 overflow-x-auto bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg"
          style={{ top: barTop, left: barLeft, maxWidth: 'calc(100vw - 16px)' }}
        >
          <BarBtn title="Table settings" active={panelOpen} onClick={onTogglePanel}>
            <FaPaintBrush className="text-[11px]" />
            <span className="text-[11px] font-semibold">Style</span>
          </BarBtn>
          <BarDivider />
          <BarBtn title="Smaller table" onClick={() => setTableAttrs(editor, { tableWidth: `${Math.max(20, widthPct - 10)}%` })}>
            <span className="text-[11px] font-semibold">W−</span>
          </BarBtn>
          <BarBtn title="Bigger table" onClick={() => setTableAttrs(editor, { tableWidth: `${Math.min(100, widthPct + 10)}%` })}>
            <span className="text-[11px] font-semibold">W+</span>
          </BarBtn>
          <BarDivider />
          <BarBtn title="Align table left" active={align === 'left'} onClick={() => setTableAttrs(editor, { tableAlign: 'left' })}>
            <FaAlignLeft className="text-[11px]" />
          </BarBtn>
          <BarBtn title="Center table" active={align === 'center'} onClick={() => setTableAttrs(editor, { tableAlign: 'center' })}>
            <FaAlignCenter className="text-[11px]" />
          </BarBtn>
          <BarBtn title="Align table right" active={align === 'right'} onClick={() => setTableAttrs(editor, { tableAlign: 'right' })}>
            <FaAlignRight className="text-[11px]" />
          </BarBtn>
          <BarDivider />
          <BarBtn title="Merge cells" disabled={!canDo('mergeCells')} onClick={run('mergeCells')}>
            <FaObjectGroup className="text-[11px]" />
          </BarBtn>
          <BarBtn title="Split cell" disabled={!canDo('splitCell')} onClick={run('splitCell')}>
            <FaObjectUngroup className="text-[11px]" />
          </BarBtn>
          <BarDivider />
          <BarBtn danger title="Delete row" onClick={run('deleteRow')}>
            <span className="text-[11px] font-semibold">−Row</span>
          </BarBtn>
          <BarBtn danger title="Delete column" onClick={run('deleteColumn')}>
            <span className="text-[11px] font-semibold">−Col</span>
          </BarBtn>
          <BarBtn danger title="Delete table" onClick={run('deleteTable')}>
            <FaTrash className="text-[11px]" />
          </BarBtn>
        </div>
      );
    }
  }

  return (
    <>
      {showRowBar && (
        <button
          type="button"
          data-table-ui
          title="Add row"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addRowEnd}
          className="fixed z-[15] flex items-center justify-center gap-1 rounded-md border border-dashed border-teal-500/30 hover:border-teal-500 bg-teal-500/5 hover:bg-teal-500/15 text-teal-600 dark:text-teal-400 opacity-60 hover:opacity-100 transition"
          style={{ left: tRect.left, width: tRect.width, top: rowBarTop, height: 16 }}
        >
          <FaPlus className="text-[8px]" />
          <span className="text-[9px] font-semibold">Row</span>
        </button>
      )}

      {showColBar && (
        <button
          type="button"
          data-table-ui
          title="Add column"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addColEnd}
          className="fixed z-[15] flex items-center justify-center rounded-md border border-dashed border-teal-500/30 hover:border-teal-500 bg-teal-500/5 hover:bg-teal-500/15 text-teal-600 dark:text-teal-400 opacity-60 hover:opacity-100 transition"
          style={{ left: colBarLeft, top: colBarTop, width: 16, height: colBarHeight }}
        >
          <FaPlus className="text-[8px]" />
        </button>
      )}

      {hover &&
        rowHandles.map((h) =>
          h.y >= minY && h.y <= maxY ? (
            <button
              key={h.cmd}
              type="button"
              data-table-ui
              title={h.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runOnCell(target, h.cmd)}
              className={handleClass}
              style={{ left: Math.max(2, tRect.left - 10), top: h.y - 10 }}
            >
              <FaPlus className="text-[8px]" />
            </button>
          ) : null
        )}

      {hover &&
        tRect.top - 10 >= minY &&
        colHandles.map((h) => (
          <button
            key={h.cmd}
            type="button"
            data-table-ui
            title={h.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runOnCell(target, h.cmd)}
            className={handleClass}
            style={{ left: h.x - 10, top: tRect.top - 10 }}
          >
            <FaPlus className="text-[8px]" />
          </button>
        ))}

      {hover && rowRect && rowRect.bottom >= minY && rowRect.top <= maxY && (
        <div
          data-table-ui
          title="Drag to resize row"
          onMouseDown={(e) => beginRowDrag(row, e)}
          className="fixed z-[15] w-3 h-6 rounded-md bg-teal-600/80 hover:bg-teal-600 text-white shadow-md flex items-center justify-center cursor-row-resize"
          style={{
            left: Math.max(2, tRect.left - 22),
            top: rowRect.top + rowRect.height / 2 - 12,
          }}
        >
          <FaGripLines className="text-[8px]" />
        </div>
      )}

      {bar}

      {panelOpen && (
        <TableSettingsSheet
          editor={editor}
          isMobile={isMobile}
          keyboardOffset={keyboardOffset}
          onClose={onTogglePanel}
        />
      )}
    </>
  );
};

// ─── EDITOR TOOLBAR ─────────────────────────────────────────────────
const EditorToolbar = ({ editor, isMobile, onOpenTableSettings }) => {
  const [openId, setOpenId] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState('');
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    if (openId === 'link') setLinkUrl(editor?.getAttributes('link')?.href || '');
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
    editor.chain().focus()
      .setImage({ src: imageUrl.trim(), width: imageWidth ? `${imageWidth}px` : null })
      .run();
    setImageUrl('');
    setImageWidth('');
    setOpenId(null);
  };

  const applyTable = () => {
    editor.chain().focus()
      .insertTable({ rows: Math.max(1, tableRows), cols: Math.max(1, tableCols), withHeaderRow: true })
      .run();
    setOpenId(null);
  };

  // ── Callout ─────────────────────────────────────────────────────
  const inCallout = editor.isActive('callout');
  const calloutAttrs = editor.getAttributes('callout');

  const wrapInCallout = (preset = {}) => {
    const attrs = {
      bgColor: preset.bgColor ?? null,
      borderColor: preset.borderColor ?? null,
      textColor: preset.textColor ?? null,
      icon: preset.icon ?? '💡',
    };
    if (inCallout) {
      editor.chain().focus().updateCallout(attrs).run();
    } else {
      editor.chain().focus().setCallout(attrs).run();
    }
  };

  const removeCallout = () => {
    if (inCallout) editor.chain().focus().unsetCallout().run();
  };

  const updateCalloutAttr = (attrs) => {
    if (inCallout) editor.chain().focus().updateCallout(attrs).run();
  };

  const collapsed = isMobile && !mobileExpanded;
  const inTable = editor.isActive('table');

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

        {/* ── CALLOUT ─────────────────────────────────────────────── */}
        <ToolbarDropdown
          id="callout" openId={openId} setOpenId={setOpenId} isMobile={isMobile}
          icon={<FaRegLightbulb className="text-xs" />} label="Callout" width={272}
          active={inCallout}
        >
          <div className="space-y-3">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (inCallout) removeCallout();
                else wrapInCallout();
                setOpenId(null);
              }}
              className={`w-full py-2 rounded-lg text-xs font-medium transition ${
                inCallout
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {inCallout ? 'Remove callout' : 'Wrap in callout'}
            </button>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Presets
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CALLOUT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { wrapInCallout(p); setOpenId(null); }}
                    className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-teal-500 transition"
                    style={{ backgroundColor: p.bgColor }}
                  >
                    <span className="text-base leading-none">{p.icon}</span>
                    <span className="text-[10px] text-gray-700">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {inCallout && (
              <>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Icon
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CALLOUT_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => updateCalloutAttr({ icon: ic })}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-base transition ${
                          calloutAttrs.icon === ic
                            ? 'bg-teal-100 dark:bg-teal-900/30 ring-2 ring-teal-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>

                <ColorRow
                  label="Background"
                  palette={CALLOUT_BG_COLORS}
                  value={calloutAttrs.bgColor}
                  onChange={(v) => updateCalloutAttr({ bgColor: v })}
                />
                <ColorRow
                  label="Accent bar"
                  palette={CALLOUT_BORDER_COLORS}
                  value={calloutAttrs.borderColor}
                  onChange={(v) => updateCalloutAttr({ borderColor: v })}
                />
                <ColorRow
                  label="Text color"
                  palette={CALLOUT_TEXT_COLORS}
                  value={calloutAttrs.textColor}
                  onChange={(v) => updateCalloutAttr({ textColor: v })}
                />
              </>
            )}
          </div>
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
          icon={<FaTable className="text-xs" />} label="Table" width={210}
          active={inTable}
        >
          <div className="space-y-2">
            {inTable && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setOpenId(null); onOpenTableSettings?.(); }}
                className="w-full flex items-center justify-center gap-1.5 text-xs py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <FaPaintBrush className="text-[10px]" /> Customize table
              </button>
            )}
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pt-1">
              Insert new table
            </div>
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
            {inTable && (
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
const EDITOR_CONTENT_CLASSES = 'note-content outline-none';
const NOTE_BODY_CLASSES = 'note-rich text-gray-800 dark:text-gray-100';

const NoteEditor = ({
  initialContent, isMobile, keyboardOffset, onChange, onSelectionChange, onEditorReady,
}) => {
  const [hoverCell, setHoverCell] = useState(null);
  const [tablePanelOpen, setTablePanelOpen] = useState(false);
  const hideTimerRef = useRef(null);
  const wrapperRef = useRef(null);

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
        code: false, codeBlock: false, blockquote: false,
        horizontalRule: false, hardBreak: false,
      }),
      Subscript, Superscript,
      TextStyle, Color, FontFamily, FontSize, BackgroundColor,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage,
      Callout,
      CustomTable.configure({ resizable: true, lastColumnResizable: true }),
      CustomTableRow,
      CustomTableHeader,
      CustomTableCell,
      EnsureTrailingParagraph,
      Placeholder.configure({ placeholder: 'Start writing your note...' }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: { class: EDITOR_CONTENT_CLASSES },
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
      } catch { rect = null; }
      onSelectionChange({ text, rect });
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => () => editor?.destroy(), [editor]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (tablePanelOpen && editor && !editor.isDestroyed && !getTableInfo(editor)) {
      setTablePanelOpen(false);
    }
  });

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    if (hideTimerRef.current) return;
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setHoverCell(null);
    }, 350);
  };

  const handleMouseMove = (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-table-ui]')) { clearHideTimer(); return; }
    const cell = t.closest('td, th');
    if (cell && cell.closest('.ProseMirror')) {
      clearHideTimer();
      setHoverCell((prev) => (prev === cell ? prev : cell));
    } else {
      scheduleHide();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="ck-note-editor-wrapper"
      onMouseMove={handleMouseMove}
      onMouseLeave={scheduleHide}
    >
      {!isMobile && (
        <div
          data-editor-toolbar
          className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161619] sticky top-0 z-10 rounded-t-xl"
        >
          <EditorToolbar
            editor={editor}
            isMobile={false}
            onOpenTableSettings={() => setTablePanelOpen(true)}
          />
        </div>
      )}

      <div className={NOTE_BODY_CLASSES}>
        <EditorContent editor={editor} />
      </div>

      {isMobile && (
        <div
          data-editor-toolbar
          className="fixed left-0 right-0 z-20 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161619]"
          style={{ bottom: keyboardOffset }}
        >
          <EditorToolbar
            editor={editor}
            isMobile={true}
            onOpenTableSettings={() => setTablePanelOpen(true)}
          />
        </div>
      )}

      <TableOverlay
        editor={editor}
        hoverCell={hoverCell}
        isMobile={isMobile}
        keyboardOffset={keyboardOffset}
        panelOpen={tablePanelOpen}
        onTogglePanel={() => setTablePanelOpen((v) => !v)}
        wrapperRef={wrapperRef}
      />
    </div>
  );
};

// ─── VIEW-MODE RENDER ──────────────────────────────────────────────
const NoteViewer = ({ content }) => (
  <div className={NOTE_BODY_CLASSES}>
    <div
      className="note-content"
      dangerouslySetInnerHTML={{ __html: content || '' }}
    />
  </div>
);

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
// BIBLE PICKER
// ═════════════════════════════════════════════════════════════════════
const BibleBookDropdown = ({ value, onChange, isMobile }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

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

  const handlePick = (book) => { onChange(book); setOpen(false); };

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
        <FaChevronDown className={`text-xs text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
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

const NumberField = ({ label, value, onChange, min = 1, placeholder, autoFocus }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
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
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
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

const BiblePickerModal = ({ open, isMobile, onClose, onSubmit, busy }) => {
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('1');

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
          isMobile ? 'w-full max-h-[90vh] rounded-t-2xl' : 'w-full max-w-md max-h-[90vh] rounded-2xl'
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
      position: 'fixed', left: '50%',
      bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      transform: 'translateX(-50%)', zIndex: 45, pointerEvents: 'auto',
    };
  } else {
    const r = selection.rect;
    const pillH = 38;
    const above = r.top > pillH + 12;
    const top = above ? r.top - pillH - 4 : r.bottom + 4;
    const pillW = 130;
    let left = r.left + r.width / 2 - pillW / 2;
    left = Math.max(8, Math.min(window.innerWidth - pillW - 8, left));
    style = { position: 'fixed', top, left, zIndex: 45, pointerEvents: 'auto' };
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
            <span key={i} className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
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
          isMobile ? 'w-full max-h-[90vh] rounded-t-2xl' : 'w-full max-w-2xl max-h-[85vh] rounded-2xl'
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

const AiPreviewModal = ({ open, isMobile, kind, result, onClose, onApply, applying }) => {
  if (!open || !result) return null;

  const isProofread = kind === 'proofread';
  const isRewrite = kind === 'rewrite';
  const isComplete = kind === 'complete';

  const suggested = isProofread
    ? result.correctedContent
    : isRewrite
      ? result.rewrittenContent
      : result.completedContent;

  const changes = (isProofread || isRewrite) ? (result.changes || []) : [];
  const addedSections = isComplete ? (result.addedSections || []) : [];

  const title = isProofread ? 'Proofread suggestion' : isRewrite ? 'Rewritten version' : 'Expanded version';

  const headerIcon = isProofread ? (
    <FaCheckDouble className="text-teal-500 text-xs" />
  ) : isRewrite ? (
    <FaFeather className="text-teal-500 text-xs" />
  ) : (
    <FaMagic className="text-teal-500 text-xs" />
  );

  return (
    <div
      className={`fixed inset-0 z-[75] flex ${
        isMobile ? 'items-end' : 'items-center justify-center'
      } bg-black/50 backdrop-blur-sm ${isMobile ? '' : 'p-4'}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white dark:bg-[#1a1a1a] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden ${
          isMobile ? 'w-full max-h-[92vh] rounded-t-2xl' : 'w-full max-w-2xl max-h-[88vh] rounded-2xl'
        }`}
      >
        {isMobile && (
          <div className="pt-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            {headerIcon}
            {title}
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

          {isRewrite && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
              {result.summary || 'Rewritten for clarity and flow.'}
              {result.style ? ` Style: ${result.style}.` : ''}
              {result.length ? ` Length: ${result.length.replace('_', ' ')}.` : ''}
            </div>
          )}

          {isComplete && result.rationale && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
              {result.rationale}
            </div>
          )}

          {(isProofread || isRewrite) && changes.length > 0 && (
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

          {isComplete && addedSections.length > 0 && (
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
                className="note-rich"
                dangerouslySetInnerHTML={{ __html: `<div class="note-content">${suggested || ''}</div>` }}
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

// ─── REWRITE SETUP MODAL ────────────────────────────────────────────
const RewriteSetupModal = ({ open, isMobile, onClose, onSubmit, busy }) => {
  const [style, setStyle] = useState('explanatory');
  const [length, setLength] = useState('same');
  const [instructions, setInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setStyle('explanatory');
      setLength('same');
      setInstructions('');
      setShowAdvanced(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => onSubmit({ style, length, instructions: instructions.trim() });

  return (
    <div
      className={`fixed inset-0 z-[78] flex ${
        isMobile ? 'items-end' : 'items-center justify-center'
      } bg-black/50 backdrop-blur-sm ${isMobile ? '' : 'p-4'}`}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className={`bg-white dark:bg-[#1a1a1a] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden ${
          isMobile ? 'w-full max-h-[92vh] rounded-t-2xl' : 'w-full max-w-lg max-h-[90vh] rounded-2xl'
        }`}
      >
        {isMobile && (
          <div className="pt-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <FaFeather className="text-teal-500 text-xs" />
              Rewrite note
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Restructure, retighten and reformat the whole note
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-40"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Style
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {REWRITE_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`text-left px-3 py-2 rounded-xl border transition ${
                    style === s.value
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`text-xs font-medium ${style === s.value ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-gray-200'}`}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-500 truncate">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Length
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {REWRITE_LENGTHS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLength(l.value)}
                  className={`text-left px-3 py-2 rounded-xl border transition ${
                    length === l.value
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`text-xs font-medium ${length === l.value ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-gray-200'}`}>
                    {l.label}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-500 truncate">{l.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
            >
              <FaChevronRight className={`text-[9px] transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              {showAdvanced ? 'Hide' : 'Add'} specific instructions (optional)
            </button>
            {showAdvanced && (
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder={`e.g. "Make it more formal", "Expand on the third paragraph", "Add a section on next steps"`}
                className="mt-2 w-full px-3 py-2 bg-gray-50 dark:bg-[#0f0f12] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-white outline-none focus:border-teal-500 resize-none"
                maxLength={1000}
              />
            )}
          </div>
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
            onClick={submit}
            disabled={busy}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <FaSpinner className="animate-spin text-xs" /> : <FaFeather className="text-xs" />}
            Rewrite
          </button>
        </div>
      </div>
    </div>
  );
};

const AiActionsMenu = ({ disabled, busy, onProofread, onComplete, onRewrite }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
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
          className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1.5 min-w-[220px]"
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
          <button
            type="button"
            onClick={() => { setOpen(false); onRewrite(); }}
            className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FaFeather className="text-teal-500 text-xs mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-800 dark:text-white">Rewrite</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                Restructure and reformat the whole note
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
const MANUAL_VERSE_WINDOW = 10;
const MANUAL_VERSE_STEP   = 10;

const WriteNote = () => {
  const { id: noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const user = useSelector((state) => state.auth?.userInfo);

  const canUseAi = Boolean(user?.isAiEnabled);
  const canUseBible = Boolean(user?.isBibleEnabled);
  const canUseQuran = Boolean(user?.isQuranEnabled);
  const canUseScripture = canUseBible || canUseQuran;
  const canUseAskAi = canUseAi || canUseScripture;

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

  const [aiSelection, setAiSelection] = useState(null);
  const [aiPanel, setAiPanel] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiBusy, setAiBusy] = useState(null);
  const [aiApplying, setAiApplying] = useState(false);
  const [showBiblePicker, setShowBiblePicker] = useState(false);
  const [showRewriteSetup, setShowRewriteSetup] = useState(false);

  const { data: noteData, isLoading: isFetching } = useGetNoteQuery(noteId, { skip: !noteId });
  const { data: notesData, isLoading: isNotesLoading } = useGetNotesQuery();
  const [createNote] = useCreateNoteMutation();
  const [updateNote] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [togglePublic] = useTogglePublicMutation();

  const [lookupScripture] = useLookupScriptureMutation();
  const [expandScripture] = useExpandScriptureMutation();
  const [searchHighlight] = useSearchHighlightMutation();
  const [proofreadNoteApi] = useProofreadNoteMutation();
  const [completeNoteApi] = useCompleteNoteMutation();
  const [rewriteNoteApi] = useRewriteNoteMutation();

  const notes = notesData?.notes || [];

  const loadedNoteRef = useRef(null);
  const currentNoteIdRef = useRef(noteId || null);
  const suppressAutosaveRef = useRef(true);
  const debounceRef = useRef(null);
  const sidebarRef = useRef(null);
  const dragRef = useRef(null);
  const isCreatingRef = useRef(false);
  const editorRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    if (!aiSelection) return;
    const clear = () => setAiSelection(null);
    window.addEventListener('scroll', clear, true);
    return () => window.removeEventListener('scroll', clear, true);
  }, [aiSelection]);

  const startResize = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
      if (newWidth > 150 && newWidth < 500) setSidebarWidth(newWidth);
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

  useEffect(() => {
    setIsEditing(Boolean(location.state?.justCreated));
    currentNoteIdRef.current = noteId || null;
    setAiSelection(null);
    setAiPanel(null);
    setAiPreview(null);
    setShowBiblePicker(false);
    setShowRewriteSetup(false);
  }, [noteId]);

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

  useEffect(() => {
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false;
      return;
    }
    if (!isEditing) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { persist(); }, AUTOSAVE_DELAY);

    return () => clearTimeout(debounceRef.current);
  }, [title, content, isPublic, isEditing, persist]);

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

    const liveHtml =
      (editorRef.current && isEditing && editorRef.current.getHTML?.()) || content || '';

    const safeName =
      (title || 'Untitled').replace(/[^a-z0-9\-_. ]/gi, '_').trim().slice(0, 80) || 'Note';

    toast.loading('Generating PDF…', { id: 'pdf-export' });

    try {
      const blob = await generatePdfFromNote(title, liveHtml);
      if (!blob) throw new Error('PDF generation returned no data');

      if (!Capacitor.isNativePlatform()) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('PDF downloaded', { id: 'pdf-export' });
        return;
      }

      const base64 = await blobToBase64(blob);
      if (!base64) throw new Error('Failed to read PDF data');

      const fileName = `${safeName}-${Date.now()}.pdf`;
      const writeResult = await Filesystem.writeFile({
        path: fileName, data: base64, directory: Directory.Cache,
      });

      try {
        const shareModule = await import('@capacitor/share').catch(() => null);
        const Share = shareModule?.Share;
        if (Share && typeof Share.share === 'function') {
          await Share.share({
            title: title || 'Note',
            text: 'Your note PDF',
            url: writeResult.uri,
            dialogTitle: 'Share PDF',
          });
          toast.success('PDF ready', { id: 'pdf-export' });
          return;
        }
      } catch (shareErr) {
        const msg = String(shareErr?.message || '');
        if (/cancel/i.test(msg)) {
          toast.success('PDF ready', { id: 'pdf-export' });
          return;
        }
      }

      toast.success('PDF saved', { id: 'pdf-export' });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF', { id: 'pdf-export' });
    }
  };

  const handleCopyShareLink = () => {
    const shareLink = noteData?.note?.shareLink;
    if (shareLink) {
      const url = `${window.location.origin}/share/${shareLink}`;
      navigator.clipboard?.writeText(url)
        .then(() => toast.success('Share link copied to clipboard'))
        .catch(() => toast.error('Failed to copy link'));
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

  const handleSelectionChange = useCallback((info) => {
    if (!canUseAskAi) return;
    if (aiPanel || aiPreview) return;
    setAiSelection(info);
  }, [aiPanel, aiPreview, canUseAskAi]);

  const handleEditorReady = useCallback((ed) => { editorRef.current = ed; }, []);

  const runBibleLookup = useCallback(async ({ book, chapter, verseStart, verseEnd }) => {
    const refString =
      verseEnd && verseEnd > verseStart
        ? `${book} ${chapter}:${verseStart}-${verseEnd}`
        : `${book} ${chapter}:${verseStart}`;

    setAiPanel({ loading: true, kind: null, data: null, error: null, expanding: false });

    try {
      const { result } = await lookupScripture({ text: refString }).unwrap();
      const lastVerse = result.verses?.[result.verses.length - 1]?.verse ?? verseEnd;
      const hitChapterEnd = verseEnd != null && lastVerse < verseEnd;

      const expandOptions = [];
      if (!hitChapterEnd) expandOptions.push({ id: 'more_verses', label: 'Show more verses' });
      expandOptions.push({ id: 'full_chapter', label: `Show full ${book} ${chapter}` });

      setAiPanel({
        loading: false, kind: 'scripture',
        data: { ...result, expandOptions },
        error: null, expanding: false,
        manualRef: { book, chapter, verseStart, verseEnd: lastVerse ?? verseEnd },
      });
    } catch (err) {
      setAiPanel({
        loading: false, kind: null, data: null,
        error: err?.data?.message || 'Could not load that passage right now.',
        expanding: false,
      });
    }
  }, [lookupScripture]);

  const handleBibleLookupSubmit = useCallback(({ book, chapter, verse }) => {
    if (!canUseBible) return;
    setShowBiblePicker(false);
    runBibleLookup({ book, chapter, verseStart: verse, verseEnd: verse + MANUAL_VERSE_WINDOW });
  }, [runBibleLookup, canUseBible]);

  const handleManualExpand = useCallback(async (mode) => {
    if (!aiPanel?.manualRef) return;
    const ref = aiPanel.manualRef;

    let nextStart = ref.verseStart;
    let nextEnd;
    if (mode === 'full_chapter') { nextStart = 1; nextEnd = 999; }
    else { nextEnd = (ref.verseEnd || ref.verseStart) + MANUAL_VERSE_STEP; }

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
      if (!hitChapterEnd) expandOptions.push({ id: 'more_verses', label: 'Show more verses' });
      if (mode !== 'full_chapter') {
        expandOptions.push({ id: 'full_chapter', label: `Show full ${ref.book} ${ref.chapter}` });
      }

      setAiPanel({
        loading: false, kind: 'scripture',
        data: { ...result, expandOptions },
        error: null, expanding: false,
        manualRef: { ...ref, verseStart: nextStart, verseEnd: lastVerse },
      });
    } catch (err) {
      toast.error(err?.data?.message || 'Could not expand the passage.');
      setAiPanel((p) => ({ ...p, expanding: false }));
    }
  }, [aiPanel, lookupScripture]);

  const handleAskAiAboutSelection = async () => {
    if (!aiSelection?.text || !canUseAskAi) return;
    const text = aiSelection.text;
    setAiSelection(null);

    try { editorRef.current?.commands.blur(); } catch { /* noop */ }

    setAiPanel({ loading: true, kind: null, data: null, error: null, expanding: false });

    try {
      if (canUseScripture) {
        const { result } = await lookupScripture({
          text, noteId: currentNoteIdRef.current || undefined,
        }).unwrap();

        const isBibleResult = result.type === 'bible';
        const isQuranResult = result.type === 'quran';

        if ((isBibleResult && canUseBible) || (isQuranResult && canUseQuran)) {
          setAiPanel({ loading: false, kind: 'scripture', data: result, error: null, expanding: false });
          return;
        }
      }

      if (canUseAi) {
        const { result: searchResult } = await searchHighlight({
          text, noteId: currentNoteIdRef.current || undefined,
        }).unwrap();

        setAiPanel({ loading: false, kind: 'search', data: searchResult, error: null, expanding: false });
        return;
      }

      setAiPanel({
        loading: false, kind: null, data: null,
        error: 'This feature isn\'t enabled for your account. Open Extensions to turn it on.',
        expanding: false,
      });
    } catch (err) {
      setAiPanel({
        loading: false, kind: null, data: null,
        error: err?.data?.message || 'Could not look that up right now.',
        expanding: false,
      });
    }
  };

  const handleExpandScripture = async (expandMode) => {
    if (!aiPanel?.data) return;
    if (aiPanel.manualRef) return handleManualExpand(expandMode);

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
    if (!currentNoteIdRef.current || !canUseAi) return;
    setAiBusy('proofread');
    try {
      const { result } = await proofreadNoteApi({ noteId: currentNoteIdRef.current }).unwrap();
      setAiPreview({ kind: 'proofread', result });
    } catch (err) {
      toast.error(err?.data?.message || 'Proofreading failed.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleComplete = async () => {
    if (!currentNoteIdRef.current || !canUseAi) return;
    setAiBusy('complete');
    try {
      const { result } = await completeNoteApi({
        noteId: currentNoteIdRef.current, style: 'explanatory',
      }).unwrap();
      setAiPreview({ kind: 'complete', result });
    } catch (err) {
      toast.error(err?.data?.message || 'Expansion failed.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleOpenRewrite = () => {
    if (!currentNoteIdRef.current || !canUseAi) return;
    setShowRewriteSetup(true);
  };

  const handleRewriteSubmit = async ({ style, length, instructions }) => {
    if (!currentNoteIdRef.current || !canUseAi) return;
    setAiBusy('rewrite');
    try {
      const { result } = await rewriteNoteApi({
        noteId: currentNoteIdRef.current, style, length, instructions,
      }).unwrap();
      setShowRewriteSetup(false);
      setAiPreview({ kind: 'rewrite', result });
    } catch (err) {
      toast.error(err?.data?.message || 'Rewrite failed.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleApplyAiPreview = async () => {
    if (!aiPreview || !editorRef.current) return;
    setAiApplying(true);
    try {
      const newContent =
        aiPreview.kind === 'proofread' ? aiPreview.result.correctedContent
          : aiPreview.kind === 'rewrite' ? aiPreview.result.rewrittenContent
            : aiPreview.result.completedContent;

      try {
        editorRef.current.commands.setContent(newContent, { emitUpdate: true });
      } catch {
        editorRef.current.commands.setContent(newContent);
      }
      handleEditorChange(editorRef.current.getHTML());

      const appliedKind = aiPreview.kind;
      setAiPreview(null);

      toast.success(
        appliedKind === 'proofread' ? 'Fixes applied'
          : appliedKind === 'rewrite' ? 'Rewrite applied'
            : 'Expansion applied'
      );
    } catch (err) {
      toast.error('Failed to apply suggestion.');
    } finally {
      setAiApplying(false);
    }
  };

  if (isFetching || isNotesLoading || !noteId) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0f0f12]">
        <FaSpinner className="animate-spin text-teal-500 text-3xl" />
      </div>
    );
  }

  const renderSidebar = () => (
    <div
      ref={sidebarRef}
      className="h-full bg-white dark:bg-[#131316] border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
            title="Go back"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 truncate">
            <FaFileAlt className="text-teal-500 flex-shrink-0" /> Notes
          </h2>
        </div>
        <button
          onClick={handleCreateNote}
          disabled={isCreatingNote}
          className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isCreatingNote ? <FaSpinner className="text-sm animate-spin" /> : <FaPlus className="text-sm" />}
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
          <button
            type="button"
            onClick={() => navigate('/extensions')}
            title="Extensions"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-teal-500 transition"
          >
            <FaPuzzlePiece className="text-sm" />
          </button>

          {canUseBible && (
            <button
              type="button"
              onClick={() => setShowBiblePicker(true)}
              title="Look up a Bible passage"
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-teal-500 transition"
            >
              <FaBookOpen className="text-sm" />
            </button>
          )}

          {isEditing && canUseAi && (
            <AiActionsMenu
              disabled={!isEditing}
              busy={aiBusy}
              onProofread={handleProofread}
              onComplete={handleComplete}
              onRewrite={handleOpenRewrite}
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
              isPublic
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
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
          {!isEditing && <NoteViewer content={content} />}
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
      <style>{NOTE_RICH_CSS}</style>

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

      {canUseAskAi && (
        <AiSelectionPill
          selection={aiSelection}
          isMobile={isMobile}
          busy={Boolean(aiPanel?.loading)}
          onClick={handleAskAiAboutSelection}
        />
      )}

      {canUseBible && (
        <BiblePickerModal
          open={showBiblePicker}
          isMobile={isMobile}
          busy={Boolean(aiPanel?.loading)}
          onClose={() => setShowBiblePicker(false)}
          onSubmit={handleBibleLookupSubmit}
        />
      )}

      {canUseAi && (
        <RewriteSetupModal
          open={showRewriteSetup}
          isMobile={isMobile}
          busy={aiBusy === 'rewrite'}
          onClose={() => setShowRewriteSetup(false)}
          onSubmit={handleRewriteSubmit}
        />
      )}

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