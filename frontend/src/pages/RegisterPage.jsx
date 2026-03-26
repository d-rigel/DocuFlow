import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Link, Alert, CircularProgress,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const login    = useAuthStore((s) => s.login);

  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }

    setLoading(true);
    try {
      const res = await authAPI.register(form.username, form.email, form.password);
      login(res.data.jwt, res.data.user);
      toast.success('Account created! Welcome to CollabDoc.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const field = (name, label, type = 'text') => (
    <TextField
      label={label}
      type={type}
      value={form[name]}
      onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      required
      autoComplete={name}
    />
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <EditIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h5" fontWeight={700} color="primary.main">
              CollabDoc
            </Typography>
          </Box>

          <Typography variant="h6" fontWeight={600} gutterBottom>Create your account</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Already have one?{' '}
            <Link component={RouterLink} to="/login">Sign in</Link>
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {field('username', 'Username')}
            {field('email', 'Email', 'email')}
            {field('password', 'Password', 'password')}
            {field('confirm', 'Confirm Password', 'password')}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Create Account'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
