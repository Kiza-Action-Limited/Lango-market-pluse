import React, { useMemo, useState } from 'react';
import { FaUserCircle, FaShieldAlt, FaEnvelope, FaUser, FaIdBadge, FaCamera } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const AdminProfile = () => {
  const { user } = useAuth();
  const profileKey = useMemo(
    () => `marketpulse_admin_profile_image_${user?._id || user?.id || 'default'}`,
    [user?._id, user?.id]
  );
  const [profileImage, setProfileImage] = useState(localStorage.getItem(profileKey) || '');

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setProfileImage(result);
      localStorage.setItem(profileKey, result);
      window.dispatchEvent(new Event('storage'));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#F97316]">Admin Profile</h1>
          <p className="text-[#6B7280]">Your administrator account details inside dashboard.</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md">
          <div className="mb-6 flex items-center gap-4 border-b border-gray-100 pb-5">
            <div className="relative">
              {profileImage ? (
                <img src={profileImage} alt="Admin profile" className="h-20 w-20 rounded-full object-cover border-2 border-[#F97316]/30" />
              ) : (
                <FaUserCircle className="text-6xl text-[#F97316]" />
              )}
              <label className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#F97316] text-white hover:bg-[#EA580C]">
                <FaCamera size={12} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-[#111827]">{user?.name || user?.fullName || 'Admin User'}</h2>
              <p className="text-sm text-gray-500">Administrator</p>
              <p className="text-xs text-[#6B7280] mt-1">Click the camera icon to upload profile image.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <FaUser />
                Full Name
              </p>
              <p className="font-medium text-[#111827]">{user?.name || user?.fullName || 'N/A'}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <FaEnvelope />
                Email
              </p>
              <p className="font-medium text-[#111827]">{user?.email || 'N/A'}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <FaShieldAlt />
                Role
              </p>
              <p className="font-medium capitalize text-[#111827]">{user?.role || 'admin'}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <FaIdBadge />
                User ID
              </p>
              <p className="font-medium text-[#111827] break-all">{user?._id || user?.id || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
