import { afterEach, describe, expect, it, vi } from "vitest"
import { runRoomRound } from "@/lib/room-round"
import { deliver } from "@/lib/group"
import type { RoomEvent } from "@/lib/room-stream"

vi.mock("@/lib/group", async (original) => ({ ...await original<typeof import("@/lib/group")>(), deliver: vi.fn(async () => ({ spoke: false })), openChat: vi.fn(async () => {}) }))
const group = ["Steve", "Jordan", "Pepe"].map((name) => ({ name, url: `http://${name.toLowerCase()}.test`, key: "test" }))
afterEach(() => vi.clearAllMocks())

describe("a round that runs out of time", () => {
  it("still lets the room hear a reply that had already come back", async () => {
    // Observed: the round's deadline landed the same second Steve said
    // "Seventy-three". Steve's history had it; nobody else did. A reply that
    // came back is said before the deadline is checked, and the round ends
    // without passing it on.
    const controller = new AbortController()
    vi.mocked(deliver).mockImplementation(async (agent) => {
      if (agent.name !== "Steve") return { spoke: false }
      controller.abort()
      return { spoke: true, text: "Seventy-three. Jordan, you’re next.", audio: null }
    })
    const events: RoomEvent[] = []
    await expect(runRoomRound({ group, message: "count", speaker: "Fabri", signal: controller.signal, emit: (e) => events.push(e) })).rejects.toThrow()
    expect(events).toContainEqual(expect.objectContaining({ type: "said", agent: "Steve", text: "Seventy-three. Jordan, you’re next." }))
    // Only the first fan-out happened: nobody was handed Steve's line.
    expect(vi.mocked(deliver).mock.calls.every(([, , speaker]) => speaker === "Fabri")).toBe(true)
  })
})
