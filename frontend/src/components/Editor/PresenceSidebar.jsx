// Small sidebar showing who is currently viewing / editing the document.

import React from 'react';
import {
  Box, Typography, Avatar, Tooltip, Chip, Divider,
} from '@mui/material';
import { FiberManualRecord as DotIcon } from '@mui/icons-material';

export default function PresenceSidebar({ users = [] }) {
  if (users.length === 0) return null;

  return (
    <Box
      sx={{
        width: 180,
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        p: 1.5,
        gap: 1,
      }}
    >
      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Online ({users.length})
      </Typography>
      <Divider />
      {users.map((u) => (
        <Box key={u.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            sx={{
              width: 28, height: 28,
              bgcolor: u.color,
              fontSize: 12, fontWeight: 700,
            }}
          >
            {u.userName?.[0]?.toUpperCase()}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="caption" fontWeight={500} noWrap>
              {u.userName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <DotIcon sx={{ fontSize: 8, color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                editing
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
