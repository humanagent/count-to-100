import { agents } from "@/lib/agents"
import { forget, ROOM } from "@/lib/group"
import { acquireRoom, awaitRoom } from "@/lib/room-round"
import { ensureRoom } from "@/lib/room-session"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET() {
  const group = agents()
  if (!group.length) return Response.json({ error: "No agents configured." }, { status: 503 })
  const release = acquireRoom()
  try {
    // Reads during a round must never insert introductions into that round.
    // Every writer also ensures initialization while holding this same lock.
    if (release) await ensureRoom(group, AbortSignal.timeout(240_000))
    return Response.json({ chat: ROOM, agents: group.map((agent) => agent.name) })
  } catch { return Response.json({ error: "The room is unavailable." }, { status: 503 }) }
  finally { release?.() }
}

/**
 * Explicit clearing is for API clients, never navigation or counting.
 *
 * The browser stops its round and asks for this in the same gesture, and the
 * round gives the room back a moment after the connection drops — so the clear
 * waits for it rather than refusing the eraser to whoever pressed it while an
 * agent was still talking. A room that stays busy past that is somebody
 * else's round, and gets the refusal.
 */
const CLEAR_PATIENCE_MS = 15_000
export async function DELETE() {
  const group = agents()
  const release = await awaitRoom(CLEAR_PATIENCE_MS)
  if (!release) return Response.json({ error: "The room is responding. Wait before clearing it." }, { status: 409 })
  try {
    const gone = await forget(group, ROOM)
    if (!gone) return Response.json({ error: "No agent took the clear." }, { status: 502 })
    await ensureRoom(group, AbortSignal.timeout(240_000))
    return Response.json({ chat: ROOM, agents: gone, complete: gone === group.length })
  } catch { return Response.json({ error: "The room could not reopen." }, { status: 503 }) }
  finally { release() }
}
