import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Grid, Card, CardContent, CardActionArea,
  CardActions, IconButton, Tooltip, Skeleton, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Search as SearchIcon,
  Article as ArticleIcon, AccessTime as TimeIcon, People as PeopleIcon,
} from '@mui/icons-material';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function DocCard({ doc, onOpen, onDelete, currentUserId }) {
  const attrs        = doc.attributes || {};
  const ownerId      = attrs.owner?.data?.id;
  const isOwner      = ownerId === currentUserId;
  const collabCount  = (attrs.collaborators?.data || []).length;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s' }}>
      <CardActionArea sx={{ flex: 1 }} onClick={() => onOpen(doc.id)}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <ArticleIcon sx={{ color: 'primary.main', mt: 0.3, flexShrink: 0 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {attrs.title || 'Untitled'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            <TimeIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {formatDate(attrs.updatedAt)}
            </Typography>
          </Box>

          {collabCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <PeopleIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {collabCount} collaborator{collabCount > 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      <CardActions sx={{ px: 2, pb: 1, justifyContent: 'space-between' }}>
        <Chip
          label={isOwner ? 'Owner' : 'Shared'}
          size="small"
          color={isOwner ? 'primary' : 'default'}
          variant="outlined"
        />
        {isOwner && (
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
              sx={{ color: 'error.light', '&:hover': { color: 'error.main' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user }     = useAuthStore();
  const { documents, loading, fetchDocuments, createDocument, deleteDocument } = useDocumentStore();

  const [search, setSearch]           = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [creating, setCreating]       = useState(false);

  useEffect(() => { fetchDocuments(); }, []);

  const filtered = documents.filter((d) =>
    (d.attributes?.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setCreating(true);
    const doc = await createDocument('Untitled Document');
    setCreating(false);
    if (doc) {
      navigate(`/documents/${doc.id}`);
    } else {
      toast.error('Failed to create document.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDocument(deleteTarget.id);
    toast.success('Document deleted.');
    setDeleteTarget(null);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>My Documents</Typography>
          <Typography variant="body2" color="text.secondary">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          disabled={creating}
        >
          New Document
        </Button>
      </Box>

      {/* Search */}
      <TextField
        placeholder="Search documents..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
          ),
        }}
      />

      {/* Document grid */}
      {loading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={140} />
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ArticleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {search ? 'No matching documents' : 'No documents yet'}
          </Typography>
          {!search && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate} sx={{ mt: 1 }}>
              Create your first document
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((doc) => (
            <Grid item xs={12} sm={6} md={4} key={doc.id}>
              <DocCard
                doc={doc}
                currentUserId={user?.id}
                onOpen={(id) => navigate(`/documents/${id}`)}
                onDelete={setDeleteTarget}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Document?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{' '}
            <strong>"{deleteTarget?.attributes?.title}"</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
