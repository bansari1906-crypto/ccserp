import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  TextField,
  Box
} from '@mui/material';
import { CloseOutlined, LogoutOutlined } from '@ant-design/icons';
import { getCurrentGpsPosition } from '../../services/locationService';
import { submitCheckOut } from '../../services/attendanceService';

export default function EndDayDialog({ open, onClose, onSuccess }) {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckOut = async () => {
    setSubmitting(true);
    setError(null);

    let pos = null;
    try {
      pos = await getCurrentGpsPosition({ timeout: 10000 }).catch(() => null);
    } catch {
      // Allow checkout even if GPS is degraded, but record if available
    }

    try {
      const res = await submitCheckOut({
        latitude: pos?.latitude || null,
        longitude: pos?.longitude || null,
        location: pos?.formattedLocation || 'End of Day Check-out',
        remarks: remarks || 'End of working day'
      });

      if (onSuccess) {
        onSuccess(res.attendance);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to sync Check Out with server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={!submitting ? onClose : undefined} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700} color="#b71c1c">
          End Working Day (Check Out)
        </Typography>
        {!submitting && (
          <IconButton size="small" onClick={onClose}>
            <CloseOutlined />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="textSecondary">
            Are you sure you want to end your working day? This will record your total shift hours and mark attendance as complete for today.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            fullWidth
            label="Daily Remarks / Tomorrow Plan (Optional)"
            multiline
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Visited 5 distributors, pending follow-up tomorrow..."
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 2.5 }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleCheckOut}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <LogoutOutlined />}
          sx={{ fontWeight: 700 }}
        >
          {submitting ? 'Checking Out...' : 'Confirm Check Out'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
