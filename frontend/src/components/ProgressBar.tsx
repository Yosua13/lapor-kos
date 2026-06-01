import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  colorClass?: string;
  height?: string;
  showLabel?: boolean;
  animated?: boolean;
}

export default function ProgressBar({
  value,
  max,
  colorClass = 'bg-brand-teal',
  height = 'h-1.5',
  showLabel = false,
  animated = true,
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div className="w-full">
      <div className={`w-full ${height} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`${height} rounded-full transition-all ${animated ? 'duration-1000 ease-out' : ''} ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-[10px] text-gray-400 font-medium mt-1 text-right">{percent}%</p>
      )}
    </div>
  );
}
