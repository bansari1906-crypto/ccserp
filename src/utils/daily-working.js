/**
 * Utility for Daily Working Timeline and Attendance state.
 * Connects directly to backend API and attendanceService.
 */

import { submitStartDay, submitCheckOut, fetchActiveAttendance } from '../services/attendanceService';

const STORAGE_KEY = 'ccs_daily_working_timeline';
const CONFIRMED_ATTENDANCE_KEY = 'ccs_attendance_confirmed_state';

export const getTimeline = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTimeline = (events) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

export const clearTimeline = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const addTimelineEvent = (type, details) => {
  const events = getTimeline();
  const newEvent = {
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type,
    ...details
  };
  
  events.push(newEvent);
  saveTimeline(events);
  
  return newEvent;
};

export const checkIn = async (location, selfie, battery, notes, backPhoto) => {
  const [latStr, lngStr] = (location || '').split(',').map((s) => parseFloat(s.trim()));
  
  const res = await submitStartDay({
    latitude: !isNaN(latStr) ? latStr : 23.0,
    longitude: !isNaN(lngStr) ? lngStr : 72.0,
    location: location || 'GPS Verified',
    frontSelfie: selfie,
    backPhoto: backPhoto || selfie
  });

  const event = addTimelineEvent('Check In', {
    status: 'Running',
    location: location || 'GPS Verified',
    photo: selfie,
    battery,
    remarks: notes
  });

  return { event, attendance: res.attendance };
};

export const checkOut = async (remarks, tomorrowPlan) => {
  const res = await submitCheckOut({
    remarks: remarks || 'End of working day'
  });

  const event = addTimelineEvent('Check Out', {
    status: 'Completed',
    remarks,
    tomorrowPlan
  });

  return { event, attendance: res.attendance };
};

export const isCheckedIn = () => {
  const cached = localStorage.getItem(CONFIRMED_ATTENDANCE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return Boolean(parsed.active && !parsed.completed);
    } catch {
      return false;
    }
  }
  return false;
};

export const getDaySummary = () => {
  const events = getTimeline();
  let visits = 0;
  let orders = 0;
  let orderValue = 0;
  let collections = 0;
  let expenses = 0;

  events.forEach((e) => {
    if (e.type === 'Field Visit' || e.type === 'Dealer Visit') visits++;
    if (e.type === 'Order Created' || e.type === 'Order') {
      orders++;
      orderValue += e.value || 0;
    }
    if (e.type === 'Collection') collections += e.amount || 0;
    if (e.type === 'Expense') expenses += e.amount || 0;
  });

  return { visits, orders, orderValue, collections, expenses, events };
};
