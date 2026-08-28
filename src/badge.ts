// Layer:  L1 -- Web SDK
// File:   src/badge.ts
// Role:   "Secured by CertiLayer" trust badge widget.
//         Inject into any page to show users their session is protected.
// Author: Youssef Emad

/** Position options for the badge */
export type BadgePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/** Badge display options */
export interface BadgeOptions {
  /** Corner to place the badge. @default "bottom-right" */
  position?: BadgePosition
  /** Badge theme. @default "dark" */
  theme?: 'dark' | 'light'
  /** Show the animated pulse dot. @default true */
  showPulse?: boolean
  /** Custom z-index. @default 999999 */
  zIndex?: number
}

const BADGE_ID     = '__cl_badge'
const BADGE_CSS_ID = '__cl_badge_css'

/**
 * Inject a "Secured by CertiLayer" trust badge into the page.
 *
 * Designed for marketing — shows users their session is protected by
 * behavioral biometrics. Lightweight (pure DOM, no deps, ~800 bytes).
 *
 * @param options - Badge display options
 *
 * @example
 * ```ts
 * import { init, showBadge } from '@certilayer/web'
 * init({ apiKey: 'certilayer_live_pk_xxx' })
 * showBadge({ position: 'bottom-right' })
 * ```
 */
export function showBadge(options: BadgeOptions = {}): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(BADGE_ID))  return

  const {
    position  = 'bottom-right',
    theme     = 'dark',
    showPulse = true,
    zIndex    = 999_999,
  } = options

  // Inject keyframe CSS once
  if (!document.getElementById(BADGE_CSS_ID)) {
    const style = document.createElement('style')
    style.id = BADGE_CSS_ID
    style.textContent = `
      @keyframes __cl_pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.5; transform: scale(0.85); }
      }
      #__cl_badge { transition: opacity 0.2s ease, transform 0.2s ease; }
      #__cl_badge:hover { opacity: 0.85 !important; transform: translateY(-1px); }
      .__cl_dot { animation: __cl_pulse 2.4s ease-in-out infinite; }
    `
    document.head.appendChild(style)
  }

  // Position mapping
  const pos: Record<BadgePosition, Record<string, string>> = {
    'bottom-right': { bottom: '16px', right:  '16px' },
    'bottom-left':  { bottom: '16px', left:   '16px' },
    'top-right':    { top:    '16px', right:  '16px' },
    'top-left':     { top:    '16px', left:   '16px' },
  }

  // Theme colours
  const isDark = theme === 'dark'
  const bg        = isDark ? 'rgba(8,7,14,0.92)'       : 'rgba(255,255,255,0.95)'
  const border    = isDark ? 'rgba(124,58,237,0.3)'     : 'rgba(124,58,237,0.2)'
  const textColor = isDark ? '#9CA3AF'                  : '#6B7280'
  const brandColor= '#A78BFA'
  const dotColor  = '#10B981'

  const badge = document.createElement('div')
  badge.id = BADGE_ID

  badge.innerHTML = `
    <div style="display:flex;align-items:center;gap:7px;">
      <!-- Shield icon -->
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        style="flex-shrink:0" aria-hidden="true">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
          fill="#7C3AED" fill-opacity="0.18" stroke="#7C3AED" stroke-width="1.8"/>
        <path d="M9 12l2 2 4-4" stroke="#A78BFA" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>

      <!-- Label -->
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                   font-size:11.5px;font-weight:500;color:${textColor};
                   white-space:nowrap;letter-spacing:0.01em;">
        Secured by&nbsp;<span style="color:${brandColor};font-weight:600;">CertiLayer</span>
      </span>

      ${showPulse ? `
      <!-- Live indicator -->
      <div style="display:flex;align-items:center;gap:4px;margin-left:2px;">
        <div class="__cl_dot" style="width:6px;height:6px;border-radius:50%;
          background:${dotColor};box-shadow:0 0 5px ${dotColor};flex-shrink:0;"></div>
        <span style="font-family:monospace;font-size:9.5px;font-weight:600;
                     color:${dotColor};letter-spacing:0.06em;text-transform:uppercase;">
          Live
        </span>
      </div>` : ''}
    </div>
  `

  Object.assign(badge.style, {
    position:        'fixed',
    display:         'flex',
    alignItems:      'center',
    padding:         '7px 12px',
    background:      bg,
    border:          `1px solid ${border}`,
    borderRadius:    '100px',
    backdropFilter:  'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    zIndex:          String(zIndex),
    cursor:          'default',
    userSelect:      'none',
    boxShadow:       isDark
      ? '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.08)'
      : '0 4px 24px rgba(0,0,0,0.1)',
    ...pos[position],
  })

  // Open certilayer.net on click
  badge.style.cursor = 'pointer'
  badge.setAttribute('role', 'link')
  badge.setAttribute('aria-label', 'Secured by CertiLayer — click to learn more')
  badge.addEventListener('click', () => {
    window.open('https://certilayer.net', '_blank', 'noopener,noreferrer')
  })

  document.body.appendChild(badge)
}

/**
 * Remove the CertiLayer badge from the page.
 */
export function hideBadge(): void {
  document.getElementById(BADGE_ID)?.remove()
}
