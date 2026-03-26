import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Tabs, Tab,
  Chip, Tooltip, CircularProgress, Button,
} from '@mui/material';
import {
  ArrowBack, Article as ArticleIcon,
  Brush as BrushIcon, CloudDone, Share as ShareIcon,
} from '@mui/icons-material';
import { useDocumentStore } from '../store/documentStore';
import CollabEditor from '../components/Editor/CollabEditor';
import Whiteboard from '../components/Whiteboard/Whiteboard';
import PresenceSidebar from '../components/Editor/PresenceSidebar';
import ShareDialog from '../components/Documents/ShareDialog';
import { usePresence } from '../hooks/usePresence';
import { useAuthStore } from '../store/authStore';

export default function EditorPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const docId      = parseInt(id, 10);

  const { currentDoc, loading, fetchDocument } = useDocumentStore();
  const { user }   = useAuthStore();
  const users      = usePresence(docId);

  const [tab, setTab]             = useState(0);    // 0 = editor, 1 = whiteboard
  const [shareOpen, setShareOpen] = useState(false);
  const [savedAt, setSavedAt]     = useState(null);

  useEffect(() => {
    fetchDocument(docId);
  }, [docId]);

  if (loading && !currentDoc) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!currentDoc && !loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <Typography variant="h6" color="text.secondary">Document not found</Typography>
        <Button variant="outlined" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </Box>
    );
  }

  const title = currentDoc?.attributes?.title || 'Loading…';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Editor app bar */}
      <AppBar
        position="static"
        elevation={0}
        color="inherit"
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar variant="dense" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Back to Dashboard">
            <IconButton edge="start" onClick={() => navigate('/dashboard')} size="small">
              <ArrowBack />
            </IconButton>
          </Tooltip>

          <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flex: 1 }}>
            {title}
          </Typography>

          {/* Saved indicator */}
          {savedAt && (
            <Chip
              icon={<CloudDone sx={{ fontSize: '14px !important' }} />}
              label={`Saved ${new Date(savedAt).toLocaleTimeString()}`}
              size="small"
              variant="outlined"
              color="success"
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />
          )}

          {/* Online users */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {users.slice(0, 5).map((u) => (
              <Tooltip key={u.userId} title={u.userName}>
                <Box
                  sx={{
                    width: 28, height: 28, borderRadius: '50%',
                    bgcolor: u.color, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 12, color: 'white',
                    fontWeight: 700, border: '2px solid white',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                  }}
                >
                  {u.userName?.[0]?.toUpperCase()}
                </Box>
              </Tooltip>
            ))}
            {users.length > 5 && (
              <Chip label={`+${users.length - 5}`} size="small" />
            )}
          </Box>

          <Button
            variant="outlined"
            size="small"
            startIcon={<ShareIcon />}
            onClick={() => setShareOpen(true)}
          >
            Share
          </Button>
        </Toolbar>

        {/* Tabs: Editor / Whiteboard */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}
        >
          <Tab icon={<ArticleIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Document" />
          <Tab icon={<BrushIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Whiteboard" />
        </Tabs>
      </AppBar>

      {/* Editor / Whiteboard pane */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <Box sx={{ flex: 1, overflow: 'auto', display: tab === 0 ? 'block' : 'none' }}>
          <CollabEditor
            documentId={docId}
            initialContent={currentDoc?.attributes?.content}
            onSaved={(ts) => setSavedAt(ts)}
          />
        </Box>

        <Box sx={{ flex: 1, display: tab === 1 ? 'flex' : 'none', flexDirection: 'column' }}>
          <Whiteboard
            documentId={docId}
            initialJson={currentDoc?.attributes?.whiteboardJson}
          />
        </Box>
      </Box>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        documentId={docId}
      />
    </Box>
  );
}
