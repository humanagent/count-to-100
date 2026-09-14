import { afterEach, describe, expect, it, vi } from "vitest"
import { acquireRoom, awaitRoom } from "@/lib/room-round"

afterEach(() => vi.useRealTimers())

describe("clearing a room that is still answering", () => {
  it("gets the room once the round lets go, instead of a refusal at first contact", async () => {
    // Observed: the eraser stops the round and asks for the delete in the
    // same gesture. The round released the room a moment later, and the
    // delete had already been told "The room is responding".
    vi.useFakeTimers()
    const round = acquireRoom()
    expect(round).not.toBeNull()
    const clear = awaitRoom(15_000)
    await vi.advanceTimersByTimeAsync(350)
    round!()
    await vi.advanceTimersByTimeAsync(100)
    const release = await clear
    expect(release).not.toBeNull()
    // It holds the room now, as any other holder would.
    expect(acquireRoom()).toBeNull()
    release!()
    const again = acquireRoom()
    expect(again).not.toBeNull()
    again!()
  })

  it("still refuses a room somebody keeps for longer than its patience", async () => {
    vi.useFakeTimers()
    const round = acquireRoom()
    const clear = awaitRoom(1_000)
    await vi.advanceTimersByTimeAsync(1_200)
    expect(await clear).toBeNull()
    round!()
  })

  it("takes a free room at once", async () => {
    const release = await awaitRoom(15_000)
    expect(release).not.toBeNull()
    release!()
  })
})
