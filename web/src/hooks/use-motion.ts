"use client"

import { useSyncExternalStore } from "react"

/**
 * Whether decorative motion should run right now.
 *
 * The same three answers `visualLoop` gives — not while the tab is hidden, not
 * under prefers-reduced-motion — as a value a component can render from. The
 * orbs need it as a prop rather than a loop: their frames are drawn by a WebGL
 * canvas that has its own scheduler, and the one thing it can be told is
 * whether to schedule at all.
 */
const query = () => matchMedia("(prefers-reduced-motion: reduce)")
function subscribe(notify: () => void) {
  const reduced = query()
  reduced.addEventListener("change", notify)
  document.addEventListener("visibilitychange", notify)
  return () => {
    reduced.removeEventListener("change", notify)
    document.removeEventListener("visibilitychange", notify)
  }
}
const read = () => !document.hidden && !query().matches

export function useMotion(): boolean {
  // Still on the server, so the first client frame matches the HTML.
  return useSyncExternalStore(subscribe, read, () => false)
}
