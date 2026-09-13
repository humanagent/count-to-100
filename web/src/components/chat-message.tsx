"use client"

import { memo, useEffect, useState } from "react"
import { CheckIcon, CopyIcon, CornerUpLeftIcon, Volume2Icon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { colorsFor } from "@/lib/agent-colors"
import { Response } from "@/components/ui/response"
import { upTo, type Position } from "@/lib/speaking"
import { visualLoop } from "@/lib/visual-motion"

export type Line = {
  id: string; speaker: string; text: string; spoken: boolean; animate?: boolean;
  delivery?: "queued" | "sending" | "sent" | "uncertain" | "not-sent" | "interrupted"
}

const deliveryLabels = { queued: "Queued", sending: "Sending", sent: "Sent", uncertain: "Connection interrupted · may have been received", "not-sent": "Not sent", interrupted: "Interrupted" }

function Reading({ text, live, where, speaker }: { text: string; live: boolean; speaker: string; where: () => Position | null }) {
  const [cut, setCut] = useState(text.length)
  const markdown = /(^|\n)\s*([#>|*-]|\d+\.)|[*_`\[]/.test(text)
  useEffect(() => {
    if (!live || markdown) return
    let last = 0
    return visualLoop((time) => {
      if (time - last > 32) {
        const at = where()
        setCut(at && at.agent === speaker ? upTo(text, at.said, at.spoken) : text.length)
        last = time
      }
    }, () => setCut(text.length))
  }, [text, speaker, live, where, markdown])
  if (markdown) return <Response>{text}</Response>
  const end = live ? cut : text.length
  return <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{text.slice(0, end)}<span className="reading-ahead">{text.slice(end)}</span></p>
}

/**
 * The agent beside its line: the library's `Avatar`, in the agent's colours.
 *
 * Not the orb. The stage already has one WebGL canvas per agent, and a
 * transcript is a list that grows; a canvas per line would run into the
 * browser's ceiling on contexts a few dozen messages in. A still gradient in
 * the same palette says whose line it is, which is all it is here for.
 */
function AgentAvatar({ name }: { name: string }) {
  const [light, color, deep] = colorsFor(name)
  return (
    <Avatar className="message-avatar" aria-hidden="true">
      <AvatarFallback className="text-transparent" style={{ background: `radial-gradient(circle at 30% 22%, ${light}, ${color} 28%, ${deep} 70%)` }}>{name.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * `mine` and `agent` are told to the message, not guessed from the speaker.
 *
 * A line used to be the reader's when its speaker was the literal `you`. Once
 * people have names there are three kinds of line in a room, not two: mine,
 * another person's, and an agent's — and only the last of those gets an orb, a
 * voice and the karaoke read-along. Deciding here would mean this component
 * knowing both who is holding the phone and which of the names are agents.
 */
export const ChatMessage = memo(function ChatMessage({ line, mine, agent, live, where, restore }: { line: Line; mine: boolean; agent: boolean; live: boolean; where: () => Position | null; restore: (text: string) => void }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])
  async function copy() {
    try { await navigator.clipboard.writeText(line.text); setCopied(true); setCopyFailed(false) }
    catch { setCopyFailed(true) }
  }
  const who = mine ? "You" : line.speaker
  return (
    <article className={`chat-message ${mine ? "from-you" : "from-agent"} ${line.animate ? "message-enter" : ""}`} aria-label={`${who} said`}>
      {agent && <AgentAvatar name={line.speaker} />}
      <div className="message-body">
        <div className="message-meta"><span>{who}</span>{agent && line.spoken && <span className="spoken-label"><Volume2Icon size={11} />{live ? "Speaking" : "Voice"}</span>}</div>
        <div className="message-bubble" data-speaking={live}>
          {agent ? <Reading text={line.text} speaker={line.speaker} live={live} where={where} /> : <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{line.text}</p>}
        </div>
        <div className="message-foot">
          {mine && line.delivery && <span role={line.delivery === "uncertain" ? "status" : undefined}>{deliveryLabels[line.delivery]}</span>}
          {mine && (line.delivery === "not-sent" || line.delivery === "uncertain") && <button onClick={() => restore(line.text)} aria-label="Use message as draft"><CornerUpLeftIcon size={12} /> Use as draft</button>}
          {!mine && <button onClick={copy} aria-label={`Copy message from ${line.speaker}`}>{copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}{copied ? "Copied" : copyFailed ? "Couldn’t copy" : "Copy"}</button>}
        </div>
      </div>
    </article>
  )
})
