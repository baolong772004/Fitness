import React from 'react';

interface AuraLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AuraLogo: React.FC<AuraLogoProps> = ({
  size = 40,
  showText = true,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`aura-logo-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        userSelect: 'none',
        ...style
      }}
    >
      {/* Pure Gym & Fitness Dumbbell Emblem */}
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          position: 'relative',
          borderRadius: Math.round(size * 0.28),
          background: 'linear-gradient(135deg, #5A2314 0%, #7A3320 60%, #8C3E26 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(90, 35, 20, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          border: '1.5px solid rgba(194, 142, 92, 0.55)',
          overflow: 'hidden'
        }}
      >
        {/* Warm Golden Sheen Corner */}
        <div
          style={{
            position: 'absolute',
            top: -size * 0.25,
            right: -size * 0.25,
            width: size * 0.75,
            height: size * 0.75,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(194, 142, 92, 0.5) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        {/* Dynamic Gym Hex Dumbbell SVG Vector */}
        <svg
          width={Math.round(size * 0.68)}
          height={Math.round(size * 0.68)}
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Outer Hexagon Ring for Strength */}
          <path
            d="M22 3L38 12.2V30.8L22 40L6 30.8V12.2L22 3Z"
            stroke="url(#gymGoldRing)"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            opacity="0.55"
          />

          {/* Left Hexagonal Dumbbell Weight Plate */}
          <path
            d="M9 14.5L14 11.5L15.5 13.5V30.5L14 32.5L9 29.5V14.5Z"
            fill="url(#gymPlateGrad)"
            stroke="#C28E5C"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M6 16.5L9 14.5V29.5L6 27.5V16.5Z"
            fill="#8C3E26"
            stroke="#C28E5C"
            strokeWidth="1"
          />

          {/* Right Hexagonal Dumbbell Weight Plate */}
          <path
            d="M35 14.5L30 11.5L28.5 13.5V30.5L30 32.5L35 29.5V14.5Z"
            fill="url(#gymPlateGrad)"
            stroke="#C28E5C"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M38 16.5L35 14.5V29.5L38 27.5V16.5Z"
            fill="#8C3E26"
            stroke="#C28E5C"
            strokeWidth="1"
          />

          {/* Central Steel Knurled Barbell Shaft */}
          <rect
            x="15.5"
            y="19.5"
            width="13"
            height="5"
            rx="1.5"
            fill="url(#steelShaftGrad)"
            stroke="#C28E5C"
            strokeWidth="1"
          />

          {/* Knurling Texture Lines on Grip */}
          <line x1="18.5" y1="20.5" x2="18.5" y2="23.5" stroke="#5A2314" strokeWidth="1" opacity="0.6" />
          <line x1="21.5" y1="20.5" x2="21.5" y2="23.5" stroke="#5A2314" strokeWidth="1" opacity="0.6" />
          <line x1="24.5" y1="20.5" x2="24.5" y2="23.5" stroke="#5A2314" strokeWidth="1" opacity="0.6" />

          {/* Athletic Energy Spark Core */}
          <circle cx="22" cy="11" r="1.5" fill="#EADBCE" />
          <circle cx="22" cy="33" r="1.5" fill="#EADBCE" />

          {/* Gradients */}
          <defs>
            <linearGradient id="gymPlateGrad" x1="6" y1="11" x2="38" y2="33" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FAF7F2" />
              <stop offset="0.5" stopColor="#EADBCE" />
              <stop offset="1" stopColor="#C28E5C" />
            </linearGradient>
            <linearGradient id="steelShaftGrad" x1="15.5" y1="19.5" x2="28.5" y2="24.5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.5" stopColor="#FAF7F2" />
              <stop offset="1" stopColor="#EADBCE" />
            </linearGradient>
            <linearGradient id="gymGoldRing" x1="6" y1="3" x2="38" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#C28E5C" />
              <stop offset="0.5" stopColor="#FAF7F2" />
              <stop offset="1" stopColor="#C28E5C" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Pure Gym & Fitness Typography */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: '-0.025em',
                color: 'var(--color-primary)'
              }}
            >
              AURA
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: '-0.025em',
                color: 'var(--aura-caramel)',
                marginLeft: 4
              }}
            >
              FITNESS
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)',
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginTop: 2
            }}
          >
            Gym & Fitness Club
          </span>
        </div>
      )}
    </div>
  );
};
