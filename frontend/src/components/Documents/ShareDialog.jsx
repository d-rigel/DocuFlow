// Dialog to add a collaborator to a document by email.

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, Typography, Box,
  CircularProgress,
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';
import { documentsAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ShareDialog({ open, onClose, documentId }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleShare = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await documentsAPI.share(documentId, email.trim());
      toast.success(`Shared with ${email}`);
      setEmail('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not share document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon color="primary" />
          Share Document
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the email address of a registered CollabDoc user to give them
          edit access to this document.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="Collaborator email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoFocus
          placeholder="colleague@example.com"
          onKeyDown={(e) => { if (e.key === 'Enter') handleShare(); }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleShare}
          variant="contained"
          disabled={!email.trim() || loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          Share
        </Button>
      </DialogActions>
    </Dialog>
  );
}
