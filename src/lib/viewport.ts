/**
 * iOS decides the size of a web app's viewport in ways that neither `100vh`,
 * `100dvh` nor `position: fixed; inset: 0` reliably agree with — in an installed
 * app it can hand back a box sized as though Safari's toolbars were still
 * there, leaving a dead strip along the bottom.
 *
 * So we stop asking the layout engine and measure it, publishing the answer as
 * `--app-height` for the shell to use.
 *
 * `window.innerHeight` is the source rather than `visualViewport.height`,
 * because the visual viewport shrinks when the software keyboard opens — the
 * shell should stay put and let the keyboard cover it.
 */

/** Reads the four `env(safe-area-inset-*)` values, which JS cannot query directly. */
function readInsets() {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);' +
    'padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const px = (v: string) => Math.round(parseFloat(v) || 0)
  const insets = {
    top: px(cs.paddingTop),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
    right: px(cs.paddingRight),
  }
  probe.remove()
  return insets
}

/**
 * How much padding the app actually has to add.
 *
 * iOS reports the device's safe-area insets even when it has *already* shrunk
 * the viewport to avoid them — pad by `env()` blindly there and the notch inset
 * gets counted twice, wasting a band across the top. So compare the viewport
 * against the screen and only pad for what is genuinely still covered.
 */
export function resolveSafePadding() {
  const insets = readInsets()
  const portrait = window.innerHeight >= window.innerWidth
  // screen.width/height do not reliably swap on rotation, so pick by size.
  const screenH = portrait
    ? Math.max(screen.width, screen.height)
    : Math.min(screen.width, screen.height)
  const gap = Math.round(screenH - window.innerHeight)
  const slack = 4

  let top = insets.top
  let bottom = insets.bottom
  if (gap >= insets.top + insets.bottom - slack) {
    // viewport already avoids both ends
    top = 0
    bottom = 0
  } else if (gap >= insets.top - slack && insets.top > 0) {
    // viewport starts below the notch, but still runs under the home indicator
    top = 0
  }
  return { insets, gap, screenH, top, bottom }
}

export function trackViewportHeight() {
  const apply = () => {
    const el = document.documentElement
    const h = Math.round(window.innerHeight || el.clientHeight)
    if (h > 0) el.style.setProperty('--app-height', `${h}px`)
    const safe = resolveSafePadding()
    el.style.setProperty('--safe-top', `${safe.top}px`)
    el.style.setProperty('--safe-bottom', `${safe.bottom}px`)
  }

  apply()

  // Orientation changes report the old size for a frame or two on iOS.
  const applySoon = () => {
    apply()
    window.setTimeout(apply, 120)
    window.setTimeout(apply, 400)
  }

  // Switching tabs (or apps) and back re-expands Safari's toolbar, shrinking
  // the viewport, but iOS doesn't fire `resize` for it — only visibility does.
  const onVisible = () => {
    if (document.visibilityState === 'visible') applySoon()
  }

  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', applySoon)
  window.addEventListener('pageshow', applySoon)
  window.addEventListener('focus', applySoon)
  document.addEventListener('visibilitychange', onVisible)
  window.visualViewport?.addEventListener('resize', apply)

  return () => {
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', applySoon)
    window.removeEventListener('pageshow', applySoon)
    window.removeEventListener('focus', applySoon)
    document.removeEventListener('visibilitychange', onVisible)
    window.visualViewport?.removeEventListener('resize', apply)
  }
}

/** Numbers worth seeing when a layout misbehaves on a device you cannot debug. */
export function viewportReport() {
  const el = document.documentElement
  const safe = resolveSafePadding()

  const displayMode =
    (['standalone', 'minimal-ui', 'fullscreen', 'browser'] as const).find((m) =>
      window.matchMedia(`(display-mode: ${m})`).matches,
    ) ?? 'unknown'

  return {
    innerHeight: window.innerHeight,
    clientHeight: el.clientHeight,
    screenHeight: window.screen.height,
    appHeight: getComputedStyle(el).getPropertyValue('--app-height').trim() || 'unset',
    insets: safe.insets,
    // how much of the screen the viewport already avoids
    gap: safe.gap,
    applied: { top: safe.top, bottom: safe.bottom },
    displayMode,
    iosStandalone: (navigator as { standalone?: boolean }).standalone === true,
    dpr: window.devicePixelRatio,
  }
}
