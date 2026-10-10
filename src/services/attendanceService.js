import api from '../api/client';

const CONFIRMED_ATTENDANCE_KEY = 'ccs_attendance_confirmed_state';

/**
 * Fetch the active attendance status for today from the real Django backend.
 * Returns: { active: boolean, completed: boolean, attendance: object | null }
 */
export const fetchActiveAttendance = async () => {
  try {
    const res = await api.get('/hr/attendance/active/', { timeout: 10000 });
    const data = res.data;

    // Cache the confirmed state locally for instant UI rendering across restarts
    if (data?.attendance) {
      localStorage.setItem(
        CONFIRMED_ATTENDANCE_KEY,
        JSON.stringify({
          active: Boolean(data.active),
          completed: Boolean(data.completed),
          attendance: data.attendance,
          cachedAt: new Date().toISOString()
        })
      );
    } else if (data && !data.active && !data.completed) {
      // Clear cache if today has no record
      localStorage.removeItem(CONFIRMED_ATTENDANCE_KEY);
    }

    return {
      active: Boolean(data.active),
      completed: Boolean(data.completed),
      attendance: data.attendance || null,
      source: 'server'
    };
  } catch (err) {
    console.warn('Failed to fetch active attendance from server:', err);
    // If network failed, check local confirmed cache to show correct status without falsifying success
    const cached = localStorage.getItem(CONFIRMED_ATTENDANCE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const cachedDate = parsed.attendance?.date;
        const todayStr = new Date().toISOString().split('T')[0];
        if (cachedDate === todayStr) {
          return {
            ...parsed,
            source: 'cache_offline',
            offline: true
          };
        }
      } catch {
        // Ignore cache parse error
      }
    }

    // Rethrow error so UI can display offline/unreachable indicator
    const errorMsg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      (err?.code === 'ECONNABORTED' ? 'Connection timed out while contacting server.' : 'Unable to connect to server. Please check your internet connection.');
    const error = new Error(errorMsg);
    error.status = err?.response?.status;
    error.networkError = !err?.response;
    throw error;
  }
};

/**
 * Submit START DAY record to the real Django backend.
 * Requires real GPS and both Front Selfie + Back Photo.
 */
export const submitStartDay = async ({
  latitude,
  longitude,
  location,
  frontSelfie,
  backPhoto
}) => {
  if (!latitude || !longitude) {
    throw new Error('Valid GPS coordinates are required to start the day.');
  }
  if (!frontSelfie) {
    throw new Error('Front camera selfie is required.');
  }
  if (!backPhoto) {
    throw new Error('Back camera worksite photo is required.');
  }

  const payload = {
    check_in_location: location || `${latitude}° N, ${longitude}° E`,
    check_in_latitude: latitude,
    check_in_longitude: longitude,
    latitude,
    longitude,
    location: location || `${latitude}° N, ${longitude}° E`,
    check_in_photo: frontSelfie,
    back_camera_photo: backPhoto,
    photo: frontSelfie,
    back_photo: backPhoto
  };

  try {
    const res = await api.post('/hr/attendance/', payload, { timeout: 25000 });
    const attendance = res.data;

    // Cache confirmed record
    localStorage.setItem(
      CONFIRMED_ATTENDANCE_KEY,
      JSON.stringify({
        active: true,
        completed: false,
        attendance,
        cachedAt: new Date().toISOString()
      })
    );

    return {
      success: true,
      attendance,
      message: 'Day started successfully!'
    };
  } catch (err) {
    console.error('submitStartDay API error:', err);

    // If already recorded today, return existing status
    if (err?.response?.data?.already_recorded && err?.response?.data?.attendance) {
      const existing = err.response.data.attendance;
      const isCompleted = Boolean(existing.check_out);
      localStorage.setItem(
        CONFIRMED_ATTENDANCE_KEY,
        JSON.stringify({
          active: !isCompleted,
          completed: isCompleted,
          attendance: existing,
          cachedAt: new Date().toISOString()
        })
      );
      return {
        success: true,
        alreadyRecorded: true,
        active: !isCompleted,
        completed: isCompleted,
        attendance: existing,
        message: 'You have already started your day today.'
      };
    }

    const errorMsg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      (err?.code === 'ECONNABORTED'
        ? 'Network request timed out while uploading attendance. Please check your signal and retry.'
        : 'Failed to record Start Day. Please verify your connection and try again.');

    const error = new Error(errorMsg);
    error.status = err?.response?.status;
    error.networkError = !err?.response;
    throw error;
  }
};

/**
 * Submit CHECK OUT / END DAY record to the real Django backend.
 */
export const submitCheckOut = async ({
  latitude,
  longitude,
  location,
  photo,
  remarks
} = {}) => {
  const payload = {
    check_out_location: location || 'GPS Verified',
    check_out_latitude: latitude || null,
    check_out_longitude: longitude || null,
    location: location || 'GPS Verified',
    check_out_photo: photo || null,
    photo: photo || null,
    remarks: remarks || 'End of working day'
  };

  try {
    const res = await api.post('/hr/attendance/check_out/', payload, { timeout: 20000 });
    const attendance = res.data;

    localStorage.setItem(
      CONFIRMED_ATTENDANCE_KEY,
      JSON.stringify({
        active: false,
        completed: true,
        attendance,
        cachedAt: new Date().toISOString()
      })
    );

    return {
      success: true,
      attendance,
      message: 'Checked out successfully!'
    };
  } catch (err) {
    console.error('submitCheckOut API error:', err);
    const errorMsg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      'Failed to record Check Out. Please check your connection and try again.';
    const error = new Error(errorMsg);
    error.status = err?.response?.status;
    throw error;
  }
};

/**
 * Fetch employee attendance history.
 */
export const fetchAttendanceHistory = async () => {
  try {
    const res = await api.get('/hr/attendance/', { timeout: 15000 });
    return Array.isArray(res.data) ? res.data : (res.data?.results || []);
  } catch (err) {
    console.error('fetchAttendanceHistory error:', err);
    throw err;
  }
};
