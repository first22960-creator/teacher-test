import React from "react";

interface WitsivaLogoProps {
  className?: string;
  showText?: boolean;
}

export const WitsivaLogo: React.FC<WitsivaLogoProps> = ({ className = "h-10 w-10", showText = false }) => {
  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      {/* High-Fidelity Custom SVG representing "วิทย์สิว่ะ" Mascot */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md select-none"
      >
        {/* Soft Light-Blue Circular Background Circle */}
        <circle cx="60" cy="60" r="54" fill="url(#blueGrad)" stroke="white" strokeWidth="3" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#5c3d98" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

        {/* Floating Science Icons */}
        {/* DNA Strand */}
        <g transform="translate(24, 28) scale(0.65)" opacity="0.85">
          <path d="M2.5 2C2.5 2 6 5.5 6 9C6 12.5 2.5 16 2.5 16" stroke="#f18023" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11.5 2C11.5 2 8 5.5 8 9C8 12.5 11.5 16 11.5 16" stroke="#5c3d98" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4.5" y1="5.5" x2="9.5" y2="5.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
          <line x1="5.8" y1="9" x2="8.2" y2="9" stroke="white" strokeWidth="1" strokeLinecap="round" />
          <line x1="4.5" y1="12.5" x2="9.5" y2="12.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
        </g>

        {/* Chemistry Beaker */}
        <g transform="translate(82, 26) scale(0.6)" opacity="0.85">
          <path d="M4 2H12M6 2L6 5M10 2L10 5M6 5L2 14C1 16 2.5 18 5 18H11C13.5 18 15 16 14 14L10 5" stroke="#f18023" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.5 13H12.5" stroke="#5c3d98" strokeWidth="1.5" opacity="0.7" />
          <circle cx="5" cy="10" r="1" fill="white" />
          <circle cx="11" cy="11" r="1.2" fill="white" />
        </g>

        {/* Atom Symbol in Hand Area */}
        <g transform="translate(18, 64) scale(0.6)" opacity="0.9">
          <ellipse cx="10" cy="10" rx="10" ry="3" transform="rotate(-30 10 10)" stroke="#5c3d98" strokeWidth="1.5" fill="none" />
          <ellipse cx="10" cy="10" rx="10" ry="3" transform="rotate(30 10 10)" stroke="#f18023" strokeWidth="1.5" fill="none" />
          <ellipse cx="10" cy="10" rx="10" ry="3" transform="rotate(90 10 10)" stroke="#7ec0ee" strokeWidth="1.2" fill="none" />
          <circle cx="10" cy="10" r="2.5" fill="#5c3d98" />
        </g>

        {/* Electric Light Bulb */}
        <g transform="translate(82, 64) scale(0.62)" opacity="0.85">
          <path d="M8 2C4.5 2 2 4.5 2 8C2 10.5 3.5 12 4.5 13L5 15H11L11.5 13C12.5 12 14 10.5 14 8C14 4.5 11.5 2 8 2Z" fill="white" stroke="#5c3d98" strokeWidth="1.5" />
          <path d="M5 15H11M6 18H10" stroke="#f18023" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 5V8" stroke="#f18023" strokeWidth="1.2" />
        </g>

        {/* Mascot Character - Wit Si Wa */}
        <g transform="translate(30, 20)">
          {/* Graduation Gown Collar / Neck area */}
          <path d="M18 55 L30 45 L42 55 L42 65 L18 65 Z" fill="#ffffff" />
          <path d="M22 48 L22 65" stroke="#f18023" strokeWidth="3" />
          <path d="M38 48 L38 65" stroke="#f18023" strokeWidth="3" />
          <path d="M30 46 L30 65" stroke="#5c3d98" strokeWidth="4.5" />
          
          {/* Face and Cheeks */}
          <path d="M15 32 C15 45, 45 45, 45 32 C45 22, 15 22, 15 32 Z" fill="#fde047" opacity="0.32" /> {/* blush */}
          <path d="M14 28 C14 42, 46 42, 46 28 C46 18, 14 18, 14 28 Z" fill="#fee2e2" /> {/* skin skin-pinkish */}
          <path d="M15 28 C15 39, 45 39, 45 28 C45 20, 15 20, 15 28 Z" fill="#ffedd5" /> {/* skin warm */}

          {/* Glowing rosy cheeks */}
          <circle cx="19" cy="31" r="3.5" fill="#f87171" opacity="0.35" />
          <circle cx="41" cy="31" r="3.5" fill="#f87171" opacity="0.35" />

          {/* Kind cartoon eyes */}
          <circle cx="23" cy="27" r="2.8" fill="#1e293b" />
          <circle cx="37" cy="27" r="2.8" fill="#1e293b" />
          <circle cx="24.2" cy="25.8" r="1" fill="white" />
          <circle cx="38.2" cy="25.8" r="1" fill="white" />

          {/* Friendly Smile */}
          <path d="M27 32 C28.5 34.5, 31.5 34.5, 33 32" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" fill="none" />

          {/* Character Hair - Short cute black/brown hair */}
          <path d="M12 25 C10 14, 20 8, 30 8 C40 8, 50 14, 48 25 C45 16, 38 15, 30 18 C22 15, 15 16, 12 25 Z" fill="#1e293b" />
          <path d="M12 25 C11 28, 13 32, 14 31 C15 30, 15 26, 15 25 Z" fill="#1e293b" />
          <path d="M48 25 C49 28, 47 32, 46 31 C45 30, 45 26, 45 25 Z" fill="#1e293b" />
          <path d="M26 12 C28 14, 32 14, 34 12" stroke="#334155" strokeWidth="1" strokeLinecap="round" fill="none" />

          {/* Soft academic gown robe shoulders */}
          <path d="M12 50 C-2 52, -2 72, 10 75 C10 65, 12 58, 20 54 Z" fill="#78716c" opacity="0.1" />
          <path d="M10 48 Q 0 54 2 80 L 58 80 Q 60 54 50 48 C 38 52 22 52 10 48 Z" fill="#93c5fd" />
          <path d="M10 48 Q 0 54 2 80 L 16 80 Q 20 56 18 49 Z" fill="#5c3d98" />
          <path d="M50 48 Q 60 54 58 80 L 44 80 Q 40 56 42 49 Z" fill="#5c3d98" />
          {/* Orange stripes on robe shoulders */}
          <path d="M14 50 L8 80" stroke="#f18023" strokeWidth="3" />
          <path d="M46 50 L52 80" stroke="#f18023" strokeWidth="3" />

          {/* Little graduation medal center */}
          <circle cx="30" cy="56" r="3" fill="#f18023" />
          <circle cx="30" cy="56" r="1.5" fill="white" />
        </g>

        {/* Sparkles */}
        <path d="M10 60 L12 62 L10 64 L8 62 Z" fill="#fde047" />
        <path d="M110 50 L111.5 51.5 L110 53 L108.5 51.5 Z" fill="#fde047" />
        <path d="M48 102 L49 103 L48 104 L47 103 Z" fill="#fde047" />

        {/* Gradients */}
        <defs>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="50%" stopColor="#7ec0ee" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      
      {showText && (
        <span className="text-xs font-bold mt-1 text-slate-800 tracking-tight leading-none">
          <span className="text-[#5c3d98]">วิทย์</span>
          <span className="text-[#f18023]">สิว่ะ</span>
        </span>
      )}
    </div>
  );
};
