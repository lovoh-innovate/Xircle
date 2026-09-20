// src/hooks/useSlashMentions.js
import { useState, useEffect, useCallback } from 'react';
import { useSearchChatEntitiesQuery } from '../slices/messagingApiSlice';

// ─────────────────────────────────────────────────────────────────────
// detectSlashQuery
//
// Walks backwards from the caret to find a "/" that starts a word.
// Returns { query, startIndex } if the caret sits inside a "/word"
// token; null otherwise.
//
// Rules:
//   - The "/" must be at position 0 OR preceded by whitespace.
//   - No whitespace is allowed between the "/" and the caret.
//   - Once whitespace is hit, we bail — the token is closed.
// ─────────────────────────────────────────────────────────────────────
const detectSlashQuery = (text, caretPos) => {
  if (caretPos <= 0) return null;

  let i = caretPos - 1;
  while (i >= 0) {
    const ch = text[i];

    if (ch === '/') {
      const before = text[i - 1];
      // Only treat as slash-command if at start or preceded by whitespace
      if (i === 0 || /\s/.test(before)) {
        return {
          query: text.slice(i + 1, caretPos),
          startIndex: i,
        };
      }
      return null;
    }

    if (/\s/.test(ch)) return null;
    i--;
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────
// useSlashMentions
//
// Wires the "/" picker into any chat input. Detects when the caret sits
// after a "/word" token, fetches matching entities in the chat's
// workspace, and returns a pending list of picked references that the
// caller sends along with the message.
//
// The hook is intentionally dumb about the input: it takes `text`,
// `setText`, and `inputRef` and manages only the picker + pending refs.
// ─────────────────────────────────────────────────────────────────────
export const useSlashMentions = ({ chatId, text, setText, inputRef }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [startIndex, setStartIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState('all');
  const [pending, setPending] = useState([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // ── Debounce the search term so we don't hammer the server ──────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  // ── Fetch entities only while the picker is open ────────────────
  const { data, isFetching } = useSearchChatEntitiesQuery(
    { chatId, q: debouncedQuery },
    { skip: !open || !chatId }
  );

  // ── Fired on every keystroke in the textarea ────────────────────
  const handleChange = useCallback(
    (e) => {
      const newText = e.target.value;
      setText(newText);

      const caret = e.target.selectionStart ?? newText.length;
      const detected = detectSlashQuery(newText, caret);

      if (detected) {
        setOpen(true);
        setQuery(detected.query);
        setStartIndex(detected.startIndex);
      } else if (open) {
        setOpen(false);
        setQuery('');
        setStartIndex(-1);
      }
    },
    [open, setText]
  );

  // ── Called when the user clicks a result ────────────────────────
  const pickReference = useCallback(
    (entity) => {
      if (!entity?.url) return;

      // Strip the "/query" token out of the input
      const before = text.slice(0, startIndex);
      const after = text.slice(startIndex + 1 + query.length);
      setText(before + after);

      // Add to pending refs (dedupe by type + id)
      setPending((prev) => {
        if (prev.some((r) => r.type === entity.type && r.refId === entity._id)) {
          return prev;
        }
        return [
          ...prev,
          {
            type: entity.type,
            refId: entity._id,
            label: entity.label,
            sublabel: entity.sublabel,
            url: entity.url,
          },
        ];
      });

      setOpen(false);
      setQuery('');
      setStartIndex(-1);

      // Refocus the input so typing continues smoothly
      setTimeout(() => {
        inputRef.current?.focus();
        // Put the caret where the "/" used to be
        const caretPos = before.length;
        try {
          inputRef.current?.setSelectionRange(caretPos, caretPos);
        } catch (_) {
          /* setSelectionRange unsupported on some inputs — safe to ignore */
        }
      }, 0);
    },
    [text, startIndex, query, setText, inputRef]
  );

  const removePending = useCallback((idx) => {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearPending = useCallback(() => setPending([]), []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setStartIndex(-1);
  }, []);

  return {
    open,
    query,
    activeTab,
    setActiveTab,
    results: data?.results || {
      tasks: [],
      projects: [],
      notes: [],
      clockins: [],
    },
    isFetching,
    handleChange,
    pickReference,
    pending,
    removePending,
    clearPending,
    close,
  };
};