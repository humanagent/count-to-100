"use client"

import { useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { ArrowUpIcon, LoaderCircleIcon, MicIcon, SquareIcon, XIcon } from "lucide-react"
import { expectMicrophone } from "@/lib/audio-session"
import { useDictation } from "@/hooks/use-dictation"
import { Waveform } from "@/components/waveform"
import { useKeyboardFocus } from "@/hooks/use-keyboard-focus"
import { getDraft, saveDraft, serverDraft, subscribeDraft } from "@/lib/draft"
import { worthSending } from "@/lib/listening"
import type { DictationState } from "@/lib/dictation"

export type ComposerHandle = { restore: (text: string) => void }

const noSubscription = () => () => {}

/** As long as a message can be before the field stops taking it. */
const PROMPT_LIMIT = 20000

export function Composer({ ready, online, busy, speech, submit, stop, handle, recordingChanged, reportError, placeholder = "Type a message…" }: {
  ready: boolean; online: boolean; busy: boolean; speech: boolean;
  submit: (text: string) => boolean; stop: () => void;
  recordingChanged: (status: DictationState["status"]) => void; reportError: (message: string | null) => void;
  handle: React.RefObject<ComposerHandle | null>
  placeholder?: string
}) {
  // Server HTML has no input handlers. Enable only after hydration, not after
  // the gateway connects: drafts must stay editable while connecting/offline.
  const interactive = useSyncExternalStore(noSubscription, () => true, () => false)
  const { text: draft, saved } = useSyncExternalStore(subscribeDraft, getDraft, serverDraft)
  const box = useRef<HTMLTextAreaElement>(null)
  const keyboardFocus = useKeyboardFocus<HTMLTextAreaElement>()
  function restore(text: string) {
    if (!text.trim()) return
    const previous = getDraft().text
    saveDraft(previous ? `${previous}\n${text}` : text)
    requestAnimationFrame(() => box.current?.focus({ preventScroll: true }))
  }
  /**
   * Whether the words being finished are going to the room or to the box.
   *
   * Stopping and sending used to be the same button, so the only way to find out
   * what had been heard was to send it to three agents and read it afterwards.
   * They are two buttons now, and one recorder still: which one was pressed is
   * the only difference between them, and it is remembered here because the
   * answer arrives later, with the committed transcript.
   *
   * A ref rather than state: nothing on screen depends on it, and it must be
   * true for the callback that has already been asked for.
   */
  const reviewing = useRef(false)
  /**
   * The same answer, for the screen: the spinner belongs on the button that was
   * pressed. It used to sit on the send button whichever way the recording
   * ended, which after pressing stop read as a send in progress.
   */
  const [endedBy, setEndedBy] = useState<"review" | "send" | null>(null)
  const dictation = useDictation({
    statusChanged: recordingChanged,
    completed: (text) => {
      const review = reviewing.current
      reviewing.current = false
      if (text.length > PROMPT_LIMIT) { restore(text); reportError(`Your message is too long. Shorten it to ${PROMPT_LIMIT.toLocaleString()} characters before sending.`) }
      else if (!worthSending(text)) reportError("No words came back. You can try recording again or keep typing.")
      // Into the field, where it can be read, edited, added to or abandoned. The
      // send button beside it is the one that costs anybody a turn.
      else if (review) restore(text)
      else if (!submit(text)) restore(text)
    },
    failed: (message, text) => { reviewing.current = false; restore(text); reportError(message) },
  })
  const listening = dictation.status !== "idle"
  const finishing = dictation.status === "finishing"
  const spinner = <LoaderCircleIcon size={18} className="animate-spin" aria-hidden="true" />
  function startRecording() {
    if (!speech || !online || !ready || listening) return false
    stop()
    reportError(null)
    reviewing.current = false
    // Said before the microphone opens, because a phone that has been told this
    // page is playing media will not also record for it.
    expectMicrophone()
    dictation.start()
    return true
  }
  /** One recorder, two ways to end it: to the room, or to the field. */
  function finish(review: boolean) {
    reviewing.current = review
    setEndedBy(review ? "review" : "send")
    dictation.finish()
  }
  function discard() {
    reviewing.current = false
    dictation.cancel()
    requestAnimationFrame(() => box.current?.focus({ preventScroll: true }))
  }
  useImperativeHandle(handle, () => ({ restore }))
  useLayoutEffect(() => {
    const node = box.current
    if (!node) return
    node.style.height = "auto"
    node.style.height = `${Math.min(node.scrollHeight, 144)}px`
  }, [draft, listening])
  function change(value: string) {
    saveDraft(value)
  }
  function send() {
    if (submit(draft.trim())) { change(""); box.current?.focus({ preventScroll: true }) }
  }
  return (
    <footer className="composer-wrap">
      <form className={`composer ${listening ? "is-recording" : ""}`} onPointerDown={(event) => {
        // The visible input includes its padded surface. Tapping that surface
        // must not blur the textarea; buttons keep their own focus behavior.
        if (event.target === event.currentTarget && box.current) {
          event.preventDefault()
          box.current.focus({ preventScroll: true })
        }
      }} onSubmit={(event) => { event.preventDefault(); if (!listening) send() }}>
        {listening ? (
          <>
            <div className="recording-content">
              <MicIcon size={18} className="recording-icon" aria-hidden="true" />
              {/* The waveform while it is hearing, and otherwise a short word for
                  what it is doing. Short because three controls share this row
                  now, the header is already saying the long version of the same
                  thing, and a status that wraps moves the whole composer. */}
              {dictation.status === "listening"
                ? <Waveform levels={dictation.levels} gate={dictation.gate} />
                : <p className="recording-note">{dictation.status === "connecting" ? "Connecting…" : "Finishing…"}</p>}
              {/* The words are no longer on screen while they are still being
                  guessed — a sentence rewriting itself is impossible to talk
                  over. They stay here for anyone reading the room by name
                  rather than by sight, to whom a waveform says nothing. */}
              <p className="sr-only" role="region" aria-label="Live transcription">{dictation.text || (dictation.status === "connecting" ? "Connecting microphone…" : "Listening…")}</p>
            </div>
            <button type="button" className="icon-button" onClick={discard} aria-label="Discard recording" title="Throw the recording away"><XIcon size={18} /></button>
            {/* The middle of three, and the one that was missing: it ends the
                recording and puts the words in the field instead of in front of
                the agents, so a sentence can be read before it is spent. */}
            <button type="button" className="icon-button" onClick={() => finish(true)} disabled={dictation.status !== "listening"} aria-label={finishing && endedBy === "review" ? "Finishing transcription" : "Stop and review"} title="Stop without sending">{finishing && endedBy === "review" ? spinner : <SquareIcon size={15} />}</button>
            <button type="button" className="send-button" onClick={() => finish(false)} disabled={dictation.status !== "listening"} aria-label={finishing && endedBy === "send" ? "Finishing transcription" : "Send recording"}>{finishing && endedBy === "send" ? spinner : <ArrowUpIcon size={20} />}</button>
          </>
        ) : (
          <>
            <textarea ref={box} {...keyboardFocus} aria-label="Message the room" rows={1} maxLength={PROMPT_LIMIT} disabled={!interactive} value={draft} onChange={(event) => change(event.target.value)} placeholder={interactive ? placeholder : "Loading…"} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send() }
            }} />
            <div className="composer-buttons">
              {busy && <button type="button" className="icon-button" onClick={stop} aria-label="Stop the room" title="Stop the room"><SquareIcon size={15} /></button>}
              <button type="button" className="icon-button" onClick={startRecording} disabled={!speech || !online || !ready} aria-label="Record a voice message" title={speech ? "Record a voice message" : "Voice is not configured"}><MicIcon size={19} /></button>
              <button type="submit" className="send-button" disabled={!draft.trim() || !ready || !online} aria-label="Send message"><ArrowUpIcon size={20} /></button>
            </div>
          </>
        )}
      </form>
      {!saved && <p className="composer-hint" role="status">Draft storage unavailable</p>}
    </footer>
  )
}
