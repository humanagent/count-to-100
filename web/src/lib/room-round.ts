import type { Agent } from "./agents"
import { audienceFor, deliver, ROOM } from "./group"
import { UNNAMED } from "./player"
import type { RoomEvent } from "./room-stream"
import { grantFor } from "./speech-grant"

// Shared across route bundles in the single Node process. Two prompts must not
// interleave in the same agents' histories.
const state = globalThis as typeof globalThis & { __roomRound?: symbol }
export function acquireRoom(): (() => void) | null {
  if (state.__roomRound) return null
  const token = Symbol("room-round")
  state.__roomRound = token
  return () => { if (state.__roomRound === token) delete state.__roomRound }
}

/** One prompt, then whatever the agents say back to each other, until quiet. */
export async function runRoomRound({ group, message, speaker = UNNAMED, signal, emit }: {
  group: Agent[]; message: string; speaker?: string; signal: AbortSignal; emit: (event: RoomEvent) => void;
}) {
  let failed = false
  // The person's own name when they have claimed the room, so the agents can
  // answer them the way they answer each other — by name.
  let pending = [{ speaker, text: message }]
  while (pending.length) {
    const next: typeof pending = []
    for (const line of pending) {
      signal.throwIfAborted()
      // Everyone the line was not spoken by, in parallel: they are answering
      // the same sentence and none of them is waiting on another.
      const settled = await Promise.allSettled(audienceFor(group, line.speaker).map(async (agent) => {
        emit({ type: "thinking", agent: agent.name })
        const reply = await deliver(agent, ROOM, line.speaker, line.text, signal)
        // Signed here, at the one place a reply becomes something the room
        // has said. The browser hands this back to ask for the voice.
        //
        // Before the abort check, not after: a reply that came back is
        // already in that agent's history. If the round ends here, the room
        // still hears it — otherwise that agent and everyone else disagree
        // about where the conversation left off.
        if (reply.spoke) emit({ type: "said", agent: agent.name, text: reply.text, audio: reply.audio, grant: grantFor(agent.name, reply.text) })
        signal.throwIfAborted()
        if (reply.spoke) next.push({ speaker: agent.name, text: reply.text })
        else if (reply.error) {
          failed = true
          emit({ type: "failed", agent: agent.name, error: "Agent unavailable" })
        } else emit({ type: "quiet", agent: agent.name })
      }))
      // Release the room only after all calls settle, including cancellation.
      const rejected = settled.find((result) => result.status === "rejected")
      if (rejected?.status === "rejected") throw rejected.reason
    }
    pending = next
  }
  return { failed }
}
