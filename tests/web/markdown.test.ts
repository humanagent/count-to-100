import { describe, expect, it } from "vitest"
import { needsMarkdown } from "@/lib/markdown"

describe("what a spoken line is rendered as", () => {
  it("reads a counted number as speech, not as the start of a list", () => {
    // Observed: told to count from 95, the agents said exactly that and the
    // screen showed "Jordan, you’re next." with no number, then a blank
    // bubble for Pepe’s "100." — CommonMark had made each line an ordered
    // list starting wherever the count was.
    expect(needsMarkdown("95. Jordan, you’re next.")).toBe(false)
    expect(needsMarkdown("100.")).toBe(false)
    expect(needsMarkdown("One hundred. We’re done!")).toBe(false)
  })

  it("still hands a real list, and real structure, to the renderer", () => {
    expect(needsMarkdown("1. wake up\n2. count to a hundred")).toBe(true)
    expect(needsMarkdown("# Plan")).toBe(true)
    expect(needsMarkdown("- one\n- two")).toBe(true)
    expect(needsMarkdown("> as Steve said")).toBe(true)
    expect(needsMarkdown("it was *loud*")).toBe(true)
    expect(needsMarkdown("run `count`")).toBe(true)
  })

  it("does not mistake a decimal or a time for numbering", () => {
    expect(needsMarkdown("3.5 seconds, then 4.2")).toBe(false)
    expect(needsMarkdown("It’s 3.47 by my clock.")).toBe(false)
  })
})
