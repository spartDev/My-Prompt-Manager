import type { FC } from 'react';

interface IconProps {
  className?: string;
}

interface DisableableIconProps extends IconProps {
  disabled?: boolean;
}

export const ClaudeIcon: FC<IconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 512 509.64"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path fill="#fcf2ee" d="m142.27 316.62 73.66-41.33 1.23-3.59-1.23-2h-3.6l-12.3-.75-42.09-1.14-36.5-1.52-35.36-1.9-8.9-1.89-8.33-11 .86-5.48 7.48-5.03 10.71.94 23.69 1.62 35.53 2.45 25.79 1.52 38.19 3.96h6.06l.86-2.45-2.07-1.51-1.62-1.52-36.77-24.92-39.81-26.34-20.86-15.17-11.27-7.68-5.69-7.2-2.45-15.73 10.24-11.27 13.75.94 3.51.93 13.93 10.72 29.75 23.03 38.85 28.6 5.69 4.73 2.27-1.61.28-1.14-2.55-4.27-21.13-38.2-22.55-38.84-10.04-16.1-2.65-9.66c-.93-3.97-1.62-7.3-1.62-11.37l11.66-15.83 6.44-2.07 15.55 2.07 6.54 5.7 9.66 22.08 15.64 34.78 24.27 47.3 7.1 14.02 3.8 13 1.4 3.96h2.46v-2.27l2-26.64 3.68-32.71 3.6-42.09 1.23-11.85 5.87-14.2 11.65-7.7 9.1 4.35 7.48 10.72L303.3 95l-4.45 28.92-8.72 45.29-5.68 30.33h3.3l3.8-3.79 15.34-20.37 25.78-32.23 11.38-12.79 13.27-14.13 8.52-6.72h16.1l11.85 17.62-5.3 18.2-16.59 21.02-13.75 17.82-19.71 26.54-12.31 21.23 1.13 1.7 2.94-.28 44.53-9.48 24.06-4.35 28.72-4.93 13 6.07 1.4 6.17-5.1 12.61-30.7 7.58-36.03 7.2-53.63 12.7-.66.48.76.93 24.16 2.28 10.34.55h25.3l47.11 3.52 12.31 8.14 7.38 9.96-1.23 7.58-18.96 9.65-25.58-6.06-59.7-14.2-20.48-5.11h-2.83v1.69l17.06 16.68 31.27 28.23 39.15 36.4 2 9-5.03 7.1-5.3-.76-34.4-25.88-13.28-11.65-30.05-25.3h-2v2.65l6.93 10.14 36.57 54.97 1.9 16.86-2.66 5.49-9.47 3.3-10.42-1.89-21.4-30.05-22.1-33.85-17.82-30.33-2.17 1.24-10.52 113.26-4.92 5.79-11.38 4.35-9.48-7.2-5.03-11.66 5.03-23.02 6.07-30.06 4.93-23.88 4.45-29.68 2.65-9.85-.18-.66-2.17.28-22.37 30.7-34.02 45.98-26.92 28.82-6.44 2.55-11.18-5.79 1.04-10.33 6.24-9.2 37.26-47.4 22.47-29.37 14.5-16.96-.1-2.45h-.85l-98.96 64.25-17.61 2.28-7.59-7.1.94-11.66 3.59-3.79 29.75-20.47-.1.1z"/>
  </svg>
);

export const ChatGPTIcon: FC<IconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 512 509.64"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M412.04 221.76a91 91 0 0 0 4.64-28.67 91 91 0 0 0-12.44-45.87 91.8 91.8 0 0 0-98.87-44.04 90.8 90.8 0 0 0-67.88-30.52h-.79a91.8 91.8 0 0 0-87.35 63.56 90.8 90.8 0 0 0-60.68 44.03 92 92 0 0 0-12.4 46.07 91.8 91.8 0 0 0 23.69 61.56 91 91 0 0 0-4.65 28.67 91 91 0 0 0 12.44 45.87 91.8 91.8 0 0 0 79.61 46.08 92 92 0 0 0 19.25-2.04 90.8 90.8 0 0 0 67.9 30.52h.8a91.8 91.8 0 0 0 87.36-63.59 90.8 90.8 0 0 0 60.68-44.03 92 92 0 0 0 12.38-46.04 91.8 91.8 0 0 0-23.69-61.55M275.1 413.16h-.1a68 68 0 0 1-43.6-15.8 57 57 0 0 0 2.15-1.22l72.54-41.9a11.8 11.8 0 0 0 5.96-10.25V241.65l30.66 17.7c.33.17.55.48.6.84v84.7a68.36 68.36 0 0 1-68.2 68.27m-146.69-62.65a68 68 0 0 1-9.15-34.08c0-3.9.34-7.82 1-11.67l2.16 1.29 72.54 41.9a11.8 11.8 0 0 0 11.92 0l88.56-51.14v35.4a1.1 1.1 0 0 1-.44.95l-73.33 42.34a68.4 68.4 0 0 1-34.1 9.12 68.4 68.4 0 0 1-59.16-34.11m-19.08-158.36a68 68 0 0 1 35.54-29.93c0 .62-.04 1.73-.04 2.5v83.87a11.8 11.8 0 0 0 5.95 10.24l88.57 51.13-30.66 17.7a1.1 1.1 0 0 1-1.04.1l-73.33-42.38a68.4 68.4 0 0 1-34.1-59.14 68.4 68.4 0 0 1 9.11-34.08m251.9 58.62-88.56-51.13 30.66-17.7a1.1 1.1 0 0 1 1.04-.1l73.34 42.34a68.3 68.3 0 0 1-10.55 123.21V261a11.8 11.8 0 0 0-5.92-10.22m30.52-45.93-2.15-1.28-72.54-41.9a12 12 0 0 0-5.96-1.62c-2.09 0-4.15.56-5.96 1.62L216.6 212.8v-35.47a1.1 1.1 0 0 1 .44-.88l73.33-42.3a68.3 68.3 0 0 1 34.1-9.13 68.3 68.3 0 0 1 68.29 68.28 69 69 0 0 1-.99 11.55m-191.84 63.11-30.67-17.7a1.1 1.1 0 0 1-.6-.84v-84.7a68.3 68.3 0 0 1 68.29-68.23 68.3 68.3 0 0 1 43.69 15.8 63 63 0 0 0-2.16 1.23l-72.54 41.9a11.8 11.8 0 0 0-5.96 10.24v.07zm16.66-35.9L256 209.25l39.45 22.77v45.55L256 300.34l-39.44-22.76z"/>
  </svg>
);

export const PerplexityIcon: FC<IconProps> = ({ className = '' }) => (
  <svg
    viewBox="-4 -2 36 40"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <style>
        {`
          .cls-1 {
            fill: none;
            stroke: #ffffff;
            stroke-miterlimit: 10;
          }
        `}
      </style>
    </defs>
    <path className="cls-1" transform="scale(0.85) translate(3, 3)" d="m23.566,1.398l-9.495,9.504h9.495V1.398v2.602V1.398Zm-9.496,9.504L4.574,1.398v9.504h9.496Zm-.021-10.902v36m9.517-15.596l-9.495-9.504v13.625l9.495,9.504v-13.625Zm-18.991,0l9.496-9.504v13.625l-9.496,9.504v-13.625ZM.5,10.9v13.57h4.074v-4.066l9.496-9.504H.5Zm13.57,0l9.495,9.504v4.066h4.075v-13.57h-13.57Z"/>
  </svg>
);

export const MistralIcon: FC<DisableableIconProps> = ({ className = '', disabled = false }) => {
  // When disabled, use grayscale colors; otherwise use the brand gradient
  const colors = disabled
    ? {
        gold: 'currentColor',
        lightOrange: 'currentColor',
        orange: 'currentColor',
        darkOrange: 'currentColor',
        red: 'currentColor'
      }
    : {
        gold: '#ffd700',
        lightOrange: '#ffaf00',
        orange: '#ff8205',
        darkOrange: '#fa500f',
        red: '#e10500'
      };

  return (
    <svg
      viewBox="0 0 212.12 151.52"
      className={`${className} scale-75`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="30.3" y="0" width="30.3" height="30.3" fill={colors.gold} />
      <rect x="151.52" y="0" width="30.3" height="30.3" fill={colors.gold} />
      <rect x="30.3" y="30.3" width="60.61" height="30.3" fill={colors.lightOrange} />
      <rect x="121.21" y="30.3" width="60.61" height="30.3" fill={colors.lightOrange} />
      <rect x="30.3" y="60.61" width="151.52" height="30.3" fill={colors.orange} />
      <rect x="30.3" y="90.91" width="30.3" height="30.3" fill={colors.darkOrange} />
      <rect x="90.91" y="90.91" width="30.3" height="30.3" fill={colors.darkOrange} />
      <rect x="151.52" y="90.91" width="30.3" height="30.3" fill={colors.darkOrange} />
      <rect x="0" y="121.21" width="90.91" height="30.3" fill={colors.red} />
      <rect x="121.21" y="121.21" width="90.91" height="30.3" fill={colors.red} />
    </svg>
  );
};

export const GeminiIcon: FC<DisableableIconProps> = ({ className = '', disabled = false }) => {
  // When disabled, use grayscale; otherwise use the brand colors
  const baseColor = disabled ? '#9ca3af' : '#3186FF';

  return (
    <svg
      height="1em"
      style={{ flex: 'none', lineHeight: 1 }}
      viewBox="0 0 24 24"
      width="1em"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Gemini</title>
      <path
        d="M20.62 10.84a14.15 14.15 0 01-4.45-3 14.11 14.11 0 01-3.68-6.45.5.5 0 00-.98 0 14.13 14.13 0 01-3.68 6.45 14.16 14.16 0 01-4.45 3c-.65.28-1.32.51-2 .68a.5.5 0 000 .98c.68.17 1.35.4 2 .68a14.15 14.15 0 014.45 3 14.11 14.11 0 013.68 6.45.5.5 0 00.98 0c.17-.69.4-1.35.68-2a14.15 14.15 0 013-4.45 14.11 14.11 0 016.45-3.68.5.5 0 000-.98 13.25 13.25 0 01-2-.68z"
        fill={baseColor}
      />
      {!disabled && (
        <>
          <path
            d="M20.62 10.84a14.15 14.15 0 01-4.45-3 14.11 14.11 0 01-3.68-6.45.5.5 0 00-.98 0 14.13 14.13 0 01-3.68 6.45 14.16 14.16 0 01-4.45 3c-.65.28-1.32.51-2 .68a.5.5 0 000 .98c.68.17 1.35.4 2 .68a14.15 14.15 0 014.45 3 14.11 14.11 0 013.68 6.45.5.5 0 00.98 0c.17-.69.4-1.35.68-2a14.15 14.15 0 013-4.45 14.11 14.11 0 016.45-3.68.5.5 0 000-.98 13.25 13.25 0 01-2-.68z"
            fill="url(#gemini-fill-0)"
          />
          <path
            d="M20.62 10.84a14.15 14.15 0 01-4.45-3 14.11 14.11 0 01-3.68-6.45.5.5 0 00-.98 0 14.13 14.13 0 01-3.68 6.45 14.16 14.16 0 01-4.45 3c-.65.28-1.32.51-2 .68a.5.5 0 000 .98c.68.17 1.35.4 2 .68a14.15 14.15 0 014.45 3 14.11 14.11 0 013.68 6.45.5.5 0 00.98 0c.17-.69.4-1.35.68-2a14.15 14.15 0 013-4.45 14.11 14.11 0 016.45-3.68.5.5 0 000-.98 13.25 13.25 0 01-2-.68z"
            fill="url(#gemini-fill-1)"
          />
          <path
            d="M20.62 10.84a14.15 14.15 0 01-4.45-3 14.11 14.11 0 01-3.68-6.45.5.5 0 00-.98 0 14.13 14.13 0 01-3.68 6.45 14.16 14.16 0 01-4.45 3c-.65.28-1.32.51-2 .68a.5.5 0 000 .98c.68.17 1.35.4 2 .68a14.15 14.15 0 014.45 3 14.11 14.11 0 013.68 6.45.5.5 0 00.98 0c.17-.69.4-1.35.68-2a14.15 14.15 0 013-4.45 14.11 14.11 0 016.45-3.68.5.5 0 000-.98 13.25 13.25 0 01-2-.68z"
            fill="url(#gemini-fill-2)"
          />
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" id="gemini-fill-0" x1="7" x2="11" y1="15.5" y2="12">
              <stop stopColor="#08B962" />
              <stop offset="1" stopColor="#08B962" stopOpacity="0" />
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" id="gemini-fill-1" x1="8" x2="11.5" y1="5.5" y2="11">
              <stop stopColor="#F94543" />
              <stop offset="1" stopColor="#F94543" stopOpacity="0" />
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" id="gemini-fill-2" x1="3.5" x2="17.5" y1="13.5" y2="12">
              <stop stopColor="#FABC12" />
              <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
            </linearGradient>
          </defs>
        </>
      )}
    </svg>
  );
};

export const CopilotIcon: FC<DisableableIconProps> = ({ className = '', disabled = false }) => {
  // When disabled, use currentColor (gray); otherwise use gradients
  const fillColor = disabled ? 'currentColor' : undefined;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Microsoft Copilot logo - colorful gradient design */}
      <path
        d="M22.93 4.97C22.52 3.79 21.41 3 20.17 3h-1.4c-1.41 0-2.62 1.01-2.87 2.4l-1.45 8.08.57-1.9C15.38 10.35 16.52 9.5 17.81 9.5h5.25l2.25 1.31 2.16-1.31h-.91c-1.25 0-2.36-.79-2.76-1.97l-.87-2.56z"
        fill={fillColor || "url(#paint0_radial_copilot)"}
      />
      <path
        d="M9.4 27.01C9.8 28.2 10.91 29 12.16 29h2.41c1.6 0 2.91-1.3 2.92-2.9l.04-7.61-.56 1.92c-.36 1.24-1.5 2.09-2.8 2.09H8.89l-1.93-1.48-2.08 1.48h.9c1.25 0 2.36.8 2.76 1.99l.86 2.52z"
        fill={fillColor || "url(#paint1_radial_copilot)"}
      />
      <path
        d="M19.75 3H8.81C5.69 3 3.81 7.09 2.56 11.18 1.08 16.02-.86 22.5 4.75 22.5h4.91c1.3 0 2.44-.86 2.81-2.11.81-2.82 2.28-7.89 3.44-11.74.57-1.92 1.05-3.57 1.78-4.59.41-.58 1.1-1.06 2.06-1.06z"
        fill={fillColor || "url(#paint2_radial_copilot)"}
      />
      {!disabled && (
        <path
          d="M19.75 3H8.81C5.69 3 3.81 7.09 2.56 11.18 1.08 16.02-.86 22.5 4.75 22.5h4.91c1.3 0 2.44-.86 2.81-2.11.81-2.82 2.28-7.89 3.44-11.74.57-1.92 1.05-3.57 1.78-4.59.41-.58 1.1-1.06 2.06-1.06z"
          fill="url(#paint3_linear_copilot)"
        />
      )}
      <path
        d="M12.25 29H23.19C26.31 29 28.19 24.91 29.44 20.82C30.92 15.98 32.85 9.5 27.25 9.5H22.34C21.04 9.5 19.89 10.36 19.53 11.61C18.72 14.42 17.25 19.5 16.1 23.35C15.52 25.27 15.04 26.92 14.31 27.94C13.9 28.52 13.21 29 12.25 29Z"
        fill={fillColor || "url(#paint4_radial_copilot)"}
      />
      {!disabled && (
        <path
          d="M12.25 29H23.19C26.31 29 28.19 24.91 29.44 20.82C30.92 15.98 32.85 9.5 27.25 9.5H22.34C21.04 9.5 19.89 10.36 19.53 11.61C18.72 14.42 17.25 19.5 16.1 23.35C15.52 25.27 15.04 26.92 14.31 27.94C13.9 28.52 13.21 29 12.25 29Z"
          fill="url(#paint5_linear_copilot)"
        />
      )}
      {!disabled && (
        <defs>
          <radialGradient
            id="paint0_radial_copilot"
            cx="0" cy="0" r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(-7.38 -8.55 -7.97 7.17 25.57 13.55)"
          >
            <stop offset="0.1" stopColor="#00AEFF"/>
            <stop offset="0.77" stopColor="#2253CE"/>
            <stop offset="1" stopColor="#0736C4"/>
          </radialGradient>
          <radialGradient
            id="paint1_radial_copilot"
            cx="0" cy="0" r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(6.62 7.93 7.81 -6.47 7.18 21.95)"
          >
            <stop stopColor="#FFB657"/>
            <stop offset="0.63" stopColor="#FF5F3D"/>
            <stop offset="0.92" stopColor="#C02B3C"/>
          </radialGradient>
          <radialGradient
            id="paint2_radial_copilot"
            cx="0" cy="0" r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(-0.99 -17.28 98.03 -5.51 8.54 22.5)"
          >
            <stop offset="0.03" stopColor="#FFC800"/>
            <stop offset="0.31" stopColor="#98BD42"/>
            <stop offset="0.49" stopColor="#52B471"/>
            <stop offset="0.84" stopColor="#0D91E1"/>
          </radialGradient>
          <linearGradient
            id="paint3_linear_copilot"
            x1="9.52" y1="3" x2="10.36" y2="22.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#3DCBFF"/>
            <stop offset="0.25" stopColor="#0588F7" stopOpacity="0"/>
          </linearGradient>
          <radialGradient
            id="paint4_radial_copilot"
            cx="0" cy="0" r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(-8.64 24.46 -29.41 -10.8 27.81 7.59)"
          >
            <stop offset="0.07" stopColor="#8C48FF"/>
            <stop offset="0.5" stopColor="#F2598A"/>
            <stop offset="0.9" stopColor="#FFB152"/>
          </radialGradient>
          <linearGradient
            id="paint5_linear_copilot"
            x1="28.67" y1="8.3" x2="28.66" y2="13.62"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.06" stopColor="#F8ADFA"/>
            <stop offset="0.71" stopColor="#A86EDD" stopOpacity="0"/>
          </linearGradient>
        </defs>
      )}
  </svg>
  );
};

// Fallback icon for custom sites (using first letter)
export const CustomSiteIcon: FC<{ letter: string; className?: string }> = ({ letter, className = '' }) => (
  <div className={`flex items-center justify-center font-semibold ${className}`}>
    {letter.toUpperCase()}
  </div>
);