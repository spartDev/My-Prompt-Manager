import { FC } from 'react';

interface IconProps {
  className?: string;
}

interface MistralIconProps extends IconProps {
  disabled?: boolean;
}

interface GeminiIconProps extends IconProps {
  disabled?: boolean;
}

interface CopilotIconProps extends IconProps {
  disabled?: boolean;
}

export const ClaudeIcon: FC<IconProps> = ({ className = '' }) => (
  <svg 
    viewBox="0 0 512 509.64" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    shapeRendering="geometricPrecision"
    textRendering="geometricPrecision"
    imageRendering="optimizeQuality"
    fillRule="evenodd"
    clipRule="evenodd"
  >
    <path fill="#FCF2EE" fillRule="nonzero" d="M142.27 316.619l73.655-41.326 1.238-3.589-1.238-1.996-3.589-.001-12.31-.759-42.084-1.138-36.498-1.516-35.361-1.896-8.897-1.895-8.34-10.995.859-5.484 7.482-5.03 10.717.935 23.683 1.617 35.537 2.452 25.782 1.517 38.193 3.968h6.064l.86-2.451-2.073-1.517-1.618-1.517-36.776-24.922-39.81-26.338-20.852-15.166-11.273-7.683-5.687-7.204-2.451-15.721 10.237-11.273 13.75.935 3.513.936 13.928 10.716 29.749 23.027 38.848 28.612 5.687 4.727 2.275-1.617.278-1.138-2.553-4.271-21.13-38.193-22.546-38.848-10.035-16.101-2.654-9.655c-.935-3.968-1.617-7.304-1.617-11.374l11.652-15.823 6.445-2.073 15.545 2.073 6.547 5.687 9.655 22.092 15.646 34.78 24.265 47.291 7.103 14.028 3.791 12.992 1.416 3.968 2.449-.001v-2.275l1.997-26.641 3.69-32.707 3.589-42.084 1.239-11.854 5.863-14.206 11.652-7.683 9.099 4.348 7.482 10.716-1.036 6.926-4.449 28.915-8.72 45.294-5.687 30.331h3.313l3.792-3.791 15.342-20.372 25.782-32.227 11.374-12.789 13.27-14.129 8.517-6.724 16.1-.001 11.854 17.617-5.307 18.199-16.581 21.029-13.75 17.819-19.716 26.54-12.309 21.231 1.138 1.694 2.932-.278 44.536-9.479 24.062-4.347 28.714-4.928 12.992 6.066 1.416 6.167-5.106 12.613-30.71 7.583-36.018 7.204-53.636 12.689-.657.48.758.935 24.164 2.275 10.337.556h25.301l47.114 3.514 12.309 8.139 7.381 9.959-1.238 7.583-18.957 9.655-25.579-6.066-59.702-14.205-20.474-5.106-2.83-.001v1.694l17.061 16.682 31.266 28.233 39.152 36.397 1.997 8.999-5.03 7.102-5.307-.758-34.401-25.883-13.27-11.651-30.053-25.302-1.996-.001v2.654l6.926 10.136 36.574 54.975 1.895 16.859-2.653 5.485-9.479 3.311-10.414-1.895-21.408-30.054-22.092-33.844-17.819-30.331-2.173 1.238-10.515 113.261-4.929 5.788-11.374 4.348-9.478-7.204-5.03-11.652 5.03-23.027 6.066-30.052 4.928-23.886 4.449-29.674 2.654-9.858-.177-.657-2.173.278-22.37 30.71-34.021 45.977-26.919 28.815-6.445 2.553-11.173-5.789 1.037-10.337 6.243-9.2 37.257-47.392 22.47-29.371 14.508-16.961-.101-2.451h-.859l-98.954 64.251-17.618 2.275-7.583-7.103.936-11.652 3.589-3.791 29.749-20.474-.101.102.024.101z"/>
  </svg>
);

export const ChatGPTIcon: FC<IconProps> = ({ className = '' }) => (
  <svg 
    viewBox="0 0 512 509.639" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    shapeRendering="geometricPrecision"
    textRendering="geometricPrecision"
    imageRendering="optimizeQuality"
    fillRule="evenodd"
    clipRule="evenodd"
  >
    <path fillRule="nonzero" d="M412.037 221.764a90.834 90.834 0 004.648-28.67 90.79 90.79 0 00-12.443-45.87c-16.37-28.496-46.738-46.089-79.605-46.089-6.466 0-12.943.683-19.264 2.04a90.765 90.765 0 00-67.881-30.515h-.576c-.059.002-.149.002-.216.002-39.807 0-75.108 25.686-87.346 63.554-25.626 5.239-47.748 21.31-60.682 44.03a91.873 91.873 0 00-12.407 46.077 91.833 91.833 0 0023.694 61.553 90.802 90.802 0 00-4.649 28.67 90.804 90.804 0 0012.442 45.87c16.369 28.504 46.74 46.087 79.61 46.087a91.81 91.81 0 0019.253-2.04 90.783 90.783 0 0067.887 30.516h.576l.234-.001c39.829 0 75.119-25.686 87.357-63.588 25.626-5.242 47.748-21.312 60.682-44.033a91.718 91.718 0 0012.383-46.035 91.83 91.83 0 00-23.693-61.553l-.004-.005zM275.102 413.161h-.094a68.146 68.146 0 01-43.611-15.8 56.936 56.936 0 002.155-1.221l72.54-41.901a11.799 11.799 0 005.962-10.251V241.651l30.661 17.704c.326.163.55.479.596.84v84.693c-.042 37.653-30.554 68.198-68.21 68.273h.001zm-146.689-62.649a68.128 68.128 0 01-9.152-34.085c0-3.904.341-7.817 1.005-11.663.539.323 1.48.897 2.155 1.285l72.54 41.901a11.832 11.832 0 0011.918-.002l88.563-51.137v35.408a1.1 1.1 0 01-.438.94l-73.33 42.339a68.43 68.43 0 01-34.11 9.12 68.359 68.359 0 01-59.15-34.11l-.001.004zm-19.083-158.36a68.044 68.044 0 0135.538-29.934c0 .625-.036 1.731-.036 2.5v83.801l-.001.07a11.79 11.79 0 005.954 10.242l88.564 51.13-30.661 17.704a1.096 1.096 0 01-1.034.093l-73.337-42.375a68.36 68.36 0 01-34.095-59.143 68.412 68.412 0 019.112-34.085l-.004-.003zm251.907 58.621l-88.563-51.137 30.661-17.697a1.097 1.097 0 011.034-.094l73.337 42.339c21.109 12.195 34.132 34.746 34.132 59.132 0 28.604-17.849 54.199-44.686 64.078v-86.308c.004-.032.004-.065.004-.096 0-4.219-2.261-8.119-5.919-10.217zm30.518-45.93c-.539-.331-1.48-.898-2.155-1.286l-72.54-41.901a11.842 11.842 0 00-5.958-1.611c-2.092 0-4.15.558-5.957 1.611l-88.564 51.137v-35.408l-.001-.061a1.1 1.1 0 01.44-.88l73.33-42.303a68.301 68.301 0 0134.108-9.129c37.704 0 68.281 30.577 68.281 68.281a68.69 68.69 0 01-.984 11.545v.005zm-191.843 63.109l-30.668-17.704a1.09 1.09 0 01-.596-.84v-84.692c.016-37.685 30.593-68.236 68.281-68.236a68.332 68.332 0 0143.689 15.804 63.09 63.09 0 00-2.155 1.222l-72.54 41.9a11.794 11.794 0 00-5.961 10.248v.068l-.05 102.23zm16.655-35.91l39.445-22.782 39.444 22.767v45.55l-39.444 22.767-39.445-22.767v-45.535z"/>
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

export const MistralIcon: FC<MistralIconProps> = ({ className = '', disabled = false }) => {
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
      viewBox="0 0 212.121 151.515"
      className={`${className} scale-75`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="30.303001" y="0" width="30.302999" height="30.302999" fill={colors.gold} strokeWidth="0" />
      <rect x="151.515" y="0" width="30.302999" height="30.302999" fill={colors.gold} strokeWidth="0" />
      <rect x="30.303001" y="30.303001" width="60.605999" height="30.302999" fill={colors.lightOrange} strokeWidth="0" />
      <rect x="121.21201" y="30.303001" width="60.605999" height="30.302999" fill={colors.lightOrange} strokeWidth="0" />
      <rect x="30.303001" y="60.606003" width="151.515" height="30.302999" fill={colors.orange} strokeWidth="0" />
      <rect x="30.303001" y="90.908997" width="30.302999" height="30.302999" fill={colors.darkOrange} strokeWidth="0" />
      <rect x="90.908997" y="90.908997" width="30.302999" height="30.302999" fill={colors.darkOrange} strokeWidth="0" />
      <rect x="151.515" y="90.908997" width="30.302999" height="30.302999" fill={colors.darkOrange} strokeWidth="0" />
      <rect x="0" y="121.21201" width="90.908997" height="30.302999" fill={colors.red} strokeWidth="0" />
      <rect x="121.21201" y="121.21201" width="90.908997" height="30.302999" fill={colors.red} strokeWidth="0" />
    </svg>
  );
};

export const GeminiIcon: FC<GeminiIconProps> = ({ className = '', disabled = false }) => {
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
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={baseColor}
      />
      {!disabled && (
        <>
          <path
            d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
            fill="url(#gemini-fill-0)"
          />
          <path
            d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
            fill="url(#gemini-fill-1)"
          />
          <path
            d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
            fill="url(#gemini-fill-2)"
          />
        </>
      )}
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
    </svg>
  );
};

export const CopilotIcon: FC<CopilotIconProps> = ({ className = '', disabled = false }) => {
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
        d="M22.9253 4.97196C22.5214 3.79244 21.4126 3 20.1658 3L18.774 3C17.3622 3 16.1532 4.01106 15.9033 5.40051L14.4509 13.4782L15.0163 11.5829C15.3849 10.347 16.5215 9.5 17.8112 9.5L23.0593 9.5L25.3054 10.809L27.4705 9.5H26.5598C25.313 9.5 24.2042 8.70756 23.8003 7.52804L22.9253 4.97196Z"
        fill={fillColor || "url(#paint0_radial_copilot)"}
      />
      <path
        d="M9.39637 27.0147C9.79613 28.2011 10.9084 29 12.1604 29H14.5727C16.1772 29 17.4805 27.704 17.4893 26.0995L17.5315 18.4862L16.9699 20.4033C16.6058 21.6461 15.4659 22.5 14.1708 22.5H8.88959L6.96437 21.0214L4.88007 22.5H5.78013C7.03206 22.5 8.14435 23.299 8.54411 24.4853L9.39637 27.0147Z"
        fill={fillColor || "url(#paint1_radial_copilot)"}
      />
      <path
        d="M19.7501 3H8.81266C5.68767 3 3.81268 7.08916 2.56269 11.1783C1.08177 16.0229 -0.856044 22.5021 4.75017 22.5021H9.66051C10.9615 22.5021 12.105 21.6415 12.4657 20.3915C13.2784 17.5759 14.7501 12.4993 15.9014 8.65192C16.4758 6.73249 16.9543 5.08404 17.6886 4.05749C18.1003 3.48196 18.7864 3 19.7501 3Z"
        fill={fillColor || "url(#paint2_radial_copilot)"}
      />
      {!disabled && (
        <path
          d="M19.7501 3H8.81266C5.68767 3 3.81268 7.08916 2.56269 11.1783C1.08177 16.0229 -0.856044 22.5021 4.75017 22.5021H9.66051C10.9615 22.5021 12.105 21.6415 12.4657 20.3915C13.2784 17.5759 14.7501 12.4993 15.9014 8.65192C16.4758 6.73249 16.9543 5.08404 17.6886 4.05749C18.1003 3.48196 18.7864 3 19.7501 3Z"
          fill="url(#paint3_linear_copilot)"
        />
      )}
      <path
        d="M12.2478 29H23.1852C26.3102 29 28.1852 24.9103 29.4352 20.8207C30.9161 15.9755 32.854 9.49548 27.2477 9.49548H22.3375C21.0364 9.49548 19.893 10.3562 19.5322 11.6062C18.7196 14.4221 17.2479 19.4994 16.0965 23.3474C15.5221 25.2671 15.0436 26.9157 14.3093 27.9424C13.8976 28.518 13.2115 29 12.2478 29Z"
        fill={fillColor || "url(#paint4_radial_copilot)"}
      />
      {!disabled && (
        <path
          d="M12.2478 29H23.1852C26.3102 29 28.1852 24.9103 29.4352 20.8207C30.9161 15.9755 32.854 9.49548 27.2477 9.49548H22.3375C21.0364 9.49548 19.893 10.3562 19.5322 11.6062C18.7196 14.4221 17.2479 19.4994 16.0965 23.3474C15.5221 25.2671 15.0436 26.9157 14.3093 27.9424C13.8976 28.518 13.2115 29 12.2478 29Z"
          fill="url(#paint5_linear_copilot)"
        />
      )}
      <defs>
      <radialGradient
        id="paint0_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(-7.37821 -8.55084 -7.96607 7.17216 25.5747 13.5466)"
      >
        <stop offset="0.0955758" stopColor="#00AEFF"/>
        <stop offset="0.773185" stopColor="#2253CE"/>
        <stop offset="1" stopColor="#0736C4"/>
      </radialGradient>
      <radialGradient
        id="paint1_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(6.61516 7.92888 7.80904 -6.47171 7.1753 21.9482)"
      >
        <stop stopColor="#FFB657"/>
        <stop offset="0.633728" stopColor="#FF5F3D"/>
        <stop offset="0.923392" stopColor="#C02B3C"/>
      </radialGradient>
      <radialGradient
        id="paint2_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(-0.990905 -17.2799 98.0282 -5.51056 8.54161 22.4952)"
      >
        <stop offset="0.03" stopColor="#FFC800"/>
        <stop offset="0.31" stopColor="#98BD42"/>
        <stop offset="0.49" stopColor="#52B471"/>
        <stop offset="0.843838" stopColor="#0D91E1"/>
      </radialGradient>
      <linearGradient
        id="paint3_linear_copilot"
        x1="9.52186" y1="3" x2="10.3572" y2="22.5029"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#3DCBFF"/>
        <stop offset="0.246674" stopColor="#0588F7" stopOpacity="0"/>
      </linearGradient>
      <radialGradient
        id="paint4_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(-8.64067 24.4636 -29.4075 -10.797 27.8096 7.58585)"
      >
        <stop offset="0.0661714" stopColor="#8C48FF"/>
        <stop offset="0.5" stopColor="#F2598A"/>
        <stop offset="0.895833" stopColor="#FFB152"/>
      </radialGradient>
      <linearGradient
        id="paint5_linear_copilot"
        x1="28.6736" y1="8.30469" x2="28.6627" y2="13.617"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0.0581535" stopColor="#F8ADFA"/>
        <stop offset="0.708063" stopColor="#A86EDD" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
  );
};

// Fallback icon for custom sites (using first letter)
export const CustomSiteIcon: FC<{ letter: string; className?: string }> = ({ letter, className = '' }) => (
  <div className={`flex items-center justify-center font-semibold ${className}`}>
    {letter.toUpperCase()}
  </div>
);