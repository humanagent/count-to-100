"use client"

import { useEffect, useRef } from "react"
import { visualLoop } from "@/lib/visual-motion"

/** Bars on screen. The meter holds more than this; the row shows its tail.
 *  Sized so the row still fits whole beside three controls on a narrow phone —
 *  a clipped bar chart reads as a rendering fault rather than a level. */
const BARS = 24
const FLOOR = 2
const CEILING = 24
/** The SDK's chunk, in the meter's readings and in time: 4096 samples at
 *  16kHz, measured 256 samples at a time. Sixteen readings every quarter second. */
const CHUNK_READINGS = 16
const CHUNK_MS = 256

/**
 * What the microphone is hearing, and nothing else.
 *
 * The words used to stream into the composer as they were guessed, which meant
 * watching a sentence rewrite itself while trying to say the next one. The
 * waveform answers the only question that matters mid-sentence — is it hearing
 * me — and the words arrive when the sentence is finished.
 *
 * The room also has an opinion about what it is hearing: under the gate, a
 * moment is measured and then dropped rather than sent to be transcribed. The
 * bars show both, because a meter that moved identically whether or not the
 * audio was going anywhere would be the most confusing thing on the screen.
 * Full ink is what is being sent; the quiet ones are the room, heard and left
 * alone.
 *
 * Height, never `scaleY`: these bars are pills, and scaling one flattens its
 * round caps into ellipses on the way up. The row is also written straight to
 * the DOM on each frame rather than through state, because sixty re-renders a
 * second to move a few pixels is a cost with nothing to show for it.
 *
 * Played out, not snapped to. The readings arrive a quarter of a second at a
 * time, and a row that showed the newest one the instant it landed moved in
 * four lurches a second — which reads as slow, not as live. Instead the row
 * lags the newest reading by up to one chunk and closes that gap one reading
 * per sixteen milliseconds, so between deliveries the bars keep walking at the
 * rate the voice was measured. Same delay as before; now it is a motion.
 */
export function Waveform({ levels, gate, heardAt }: { levels: () => readonly number[]; gate?: () => number; heardAt?: () => number }) {
  const row = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bars = [...(row.current?.children ?? [])] as HTMLElement[]
    const paint = (heights: number[], sent: boolean[] = []) => bars.forEach((bar, i) => {
      bar.style.height = `${heights[i]}px`
      bar.style.opacity = sent[i] === false ? "0.3" : "1"
    })
    const flat = () => paint(bars.map(() => FLOOR))
    return visualLoop((time) => {
      const recent = levels()
      // How much of the newest chunk has been "played": all of it when there
      // is no clock to play against, or once the next one is due.
      const since = heardAt ? time - heardAt() : Infinity
      const played = Math.min(CHUNK_READINGS, Math.floor(since / (CHUNK_MS / CHUNK_READINGS)))
      const lag = Math.min(CHUNK_READINGS - played, Math.max(0, recent.length - BARS))
      const tail = recent.slice(0, recent.length - lag).slice(-BARS)
      const level = gate?.() ?? 0
      const sent = bars.map((_, i) => {
        const value = tail[i - (BARS - tail.length)] ?? 0
        return level <= 0 || value >= level
      })
      paint(bars.map((_, i) => {
        const value = tail[i - (BARS - tail.length)] ?? 0
        // A voice sits low in a linear scale and a loud room fills it; the
        // curve gives ordinary speech most of the height it has.
        const scaled = Math.min(1, Math.sqrt(value) * 2.6)
        return Math.round(FLOOR + scaled * (CEILING - FLOOR))
      }), sent)
    }, flat)
  }, [levels, gate, heardAt])

  return (
    <div className="waveform" ref={row} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => <i key={i} style={{ height: FLOOR }} />)}
    </div>
  )
}
