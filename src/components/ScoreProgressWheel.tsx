import React from "react";

interface ScoreProgressWheelProps {
  percentage: number;
}

export function ScoreProgressWheel({ percentage }: ScoreProgressWheelProps) {
  // SVG Arc calculation
  const radius = 30;
  const strokeWidth = 5.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine levels and styles based on ranking percentages
  let textHex = "text-rose-600";
  let bgBorder = "bg-rose-50/50 border-rose-100 text-rose-700";
  let strokeColor = "stroke-rose-500";
  let label = "ควรปรับปรุง 🔴";

  if (percentage >= 85) {
    textHex = "text-amber-600";
    bgBorder = "bg-amber-50/70 border-amber-200 text-amber-700";
    strokeColor = "stroke-amber-500";
    label = "ยอดเยี่ยม 🏆";
  } else if (percentage >= 70) {
    textHex = "text-emerald-600";
    bgBorder = "bg-emerald-50/50 border-emerald-100 text-emerald-700";
    strokeColor = "stroke-emerald-500";
    label = "ดี 🟢";
  } else if (percentage >= 50) {
    textHex = "text-amber-500";
    bgBorder = "bg-amber-50/30 border-amber-100 text-amber-650";
    strokeColor = "stroke-amber-400";
    label = "พอใช้ 🟡";
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)] shrink-0 min-w-[100px] w-full sm:w-auto">
      <div 
        className="relative flex items-center justify-center select-none" 
        style={{ width: radius * 2 + strokeWidth, height: radius * 2 + strokeWidth }}
      >
        <svg className="transform -rotate-90 w-full h-full">
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth / 2}
            cy={radius + strokeWidth / 2}
            r={radius}
            className="stroke-slate-100 fill-transparent"
            strokeWidth={strokeWidth}
          />
          {/* Animated score indicator wheel */}
          <circle
            cx={radius + strokeWidth / 2}
            cy={radius + strokeWidth / 2}
            r={radius}
            className={`fill-transparent transition-[stroke-dashoffset] duration-1000 ease-out ${strokeColor}`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Center score percent */}
        <div className="absolute text-center">
          <span className="text-[13px] font-black tracking-tight text-slate-800 font-mono">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      {/* Human readability custom subtext */}
      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-black text-center whitespace-nowrap ${bgBorder}`}>
        {label}
      </span>
    </div>
  );
}
