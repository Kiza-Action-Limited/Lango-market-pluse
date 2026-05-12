import React from 'react';

const AppShellSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 animate-fade-in">
      <div className="h-16 bg-white border-b border-gray-200" />
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="h-10 w-2/3 rounded bg-gray-200 skeleton-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-56 rounded-xl bg-white border border-gray-100 p-4">
              <div className="h-28 rounded bg-gray-200 skeleton-shimmer" />
              <div className="mt-4 h-4 w-3/4 rounded bg-gray-200 skeleton-shimmer" />
              <div className="mt-2 h-4 w-1/2 rounded bg-gray-200 skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppShellSkeleton;
