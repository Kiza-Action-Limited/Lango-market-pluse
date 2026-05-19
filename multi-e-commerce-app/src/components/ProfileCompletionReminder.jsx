import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dismissProfileReminder, snoozeProfileReminder } from '../redux/slices/uiSlice';

const ProfileCompletionReminder = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useAuth();
  const reminderState = useSelector((state) => state?.ui?.profileReminder);
  const dismissed = Boolean(reminderState?.dismissed);
  const snoozedUntil = reminderState?.snoozedUntil || null;

  const profileCompletion = useMemo(() => {
    if (!user) return 100;
    const fields = ['name', 'email', 'phone', 'address'];
    const filled = fields.filter((field) => String(user?.[field] || '').trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [user]);

  if (!isAuthenticated) return null;
  if (dismissed) return null;
  if (snoozedUntil && Date.now() < snoozedUntil) return null;
  if (profileCompletion >= 100) return null;

  return (
    <div className="bg-[#FFF7ED] border border-[#FB923C]/40 rounded-lg px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[#9A3412]">
        Profile is {profileCompletion}% complete. Add missing details for better recommendations and faster checkout.
      </p>
      <div className="flex items-center gap-2">
        <Link to="/profile" className="text-sm font-semibold text-[#EA580C] hover:underline">
          Complete now
        </Link>
        <button
          type="button"
          onClick={() => dispatch(snoozeProfileReminder(180))}
          className="text-xs px-2 py-1 rounded border border-[#FDBA74] text-[#9A3412] hover:bg-[#FED7AA]"
        >
          Snooze 3h
        </button>
        <button
          type="button"
          onClick={() => dispatch(dismissProfileReminder())}
          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ProfileCompletionReminder;
