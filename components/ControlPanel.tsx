import React from 'react';

export default function ControlPanel() {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm flex flex-col gap-4">
      <h2 className="font-bold text-lg">Control Panel</h2>
      <div className="flex justify-between items-center">
        <span className="font-semibold">Score: 0</span>
        <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
          Dispatch
        </button>
      </div>
    </div>
  );
}
