// Rich-text editor powered by Quill (via react-quill).
// Real-time sync is handled by useCollabEditor hook.

import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Box, Paper, Typography } from '@mui/material';
import { useCollabEditor } from '../../hooks/useCollabEditor';
import { documentsAPI } from '../../services/api';
import toast from 'react-hot-toast';

// Quill toolbar config
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ align: [] }],
  ['blockquote', 'code-block'],
  ['link', 'image'],
  ['clean'],
];

const FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet', 'indent',
  'align', 'blockquote', 'code-block', 'link', 'image',
];

export default function CollabEditor({ documentId, initialContent, onSaved }) {
  const quillRef = useRef(null);
  const [value, setValue] = useState('');
  const [wordCount, setWordCount] = useState(0);

  const { handleChange, handleSelectionChange } = useCollabEditor(quillRef, documentId);

  // Load initial content from DB into editor
  useEffect(() => {
    if (!initialContent) return;
    try {
      const parsed = JSON.parse(initialContent);
      const quill  = quillRef.current?.getEditor?.();
      if (quill && parsed?.ops) {
        // Use setContents to avoid triggering 'user' change event
        quill.setContents(parsed, 'api');
      }
    } catch {
      // Plain text fallback
      setValue(initialContent);
    }
  }, [initialContent]);

  // Word count
  const updateWordCount = useCallback(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;
    const text = quill.getText().trim();
    setWordCount(text ? text.split(/\s+/).length : 0);
  }, []);

  // Manual save with Ctrl/Cmd+S
  useEffect(() => {
    const onKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const quill = quillRef.current?.getEditor?.();
        if (!quill) return;
        try {
          await documentsAPI.update(documentId, {
            content: JSON.stringify(quill.getContents()),
            lastSavedAt: new Date().toISOString(),
          });
          const ts = new Date().toISOString();
          onSaved?.(ts);
          toast.success('Saved!', { duration: 1500 });
        } catch {
          toast.error('Save failed.');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [documentId, onSaved]);

  const onEditorChange = (val, delta, source, editor) => {
    setValue(val);
    updateWordCount();
    handleChange(val, delta, source, editor);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.default',
      }}
    >
      {/* Paper document feel */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 3,
          px: { xs: 1, sm: 3 },
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={2}
          sx={{
            width: '100%',
            maxWidth: 820,
            minHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={value}
            onChange={onEditorChange}
            onChangeSelection={handleSelectionChange}
            modules={{ toolbar: TOOLBAR_OPTIONS }}
            formats={FORMATS}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            placeholder="Start writing… (Ctrl+S to save)"
          />
        </Paper>
      </Box>

      {/* Status bar */}
      <Box
        sx={{
          px: 3, py: 0.75,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {wordCount} word{wordCount !== 1 ? 's' : ''} · Ctrl+S to save
        </Typography>
      </Box>
    </Box>
  );
}
