import { expect, said, test, type Page } from "../../../web/test-support/browser"

const reply = "A friendly conversation continues."

async function mockRoom(page: Page) {
  await page.route("**/api/room", (route) => route.fulfill({ json: { chat: "room", agents: ["Steve", "Jordan", "Pepe"], complete: true } }))
  await page.route("**/api/history?*", (route) => route.fulfill({ json: { lines: [] } }))
  await page.route("**/api/telemetry", (route) => route.fulfill({ status: 204 }))
  await page.route("**/api/say", (route) => route.fulfill({ contentType: "text/event-stream", body: [
    said("Steve", reply), { type: "done" },
  ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") }))
  await page.route("**/api/speak?*", (route) => route.fulfill({ json: {
    audio: "AA==", chars: Array.from(reply), starts: Array.from(reply, (_, i) => i < 2 ? 0 : 60),
  } }))
}

test("modal entrance never shifts the room, and reduced motion removes it", async ({ page }) => {
  await mockRoom(page)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  const start = page.getByRole("button", { name: "Clear the room", exact: true })
  await expect(start).toBeEnabled()
  const samples = await start.evaluate(async (button) => {
    const surfaces = [".room-header", ".agent-stage", ".composer-wrap"]
    const measure = () => surfaces.map((selector) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect()
      return [rect.x, rect.y, rect.width, rect.height]
    })
    const frames = [measure()]
    ;(button as HTMLButtonElement).click()
    for (let i = 0; i < 24; i++) {
      await new Promise(requestAnimationFrame)
      frames.push(measure())
    }
    return frames
  })
  for (const frame of samples) {
    for (let surface = 0; surface < frame.length; surface++) {
      frame[surface].forEach((value, axis) => expect(Math.abs(value - samples[0][surface][axis])).toBeLessThan(1))
    }
  }
  const dialog = page.getByRole("dialog", { name: "Clear the room?" })
  await expect(dialog.getByRole("button", { name: "Keep the conversation" })).toBeFocused()
  // The library's Dialog enters with tw-animate's `enter` keyframes on the
  // content and on its overlay, which is a sibling element rather than a
  // ::backdrop. Short, and gone entirely under reduced motion.
  const overlay = page.locator("[data-slot=dialog-overlay]")
  expect(await dialog.evaluate((node) => {
    const style = getComputedStyle(node)
    return { name: style.animationName, duration: style.animationDuration }
  })).toEqual({ name: "enter", duration: "0.2s" })
  await expect(overlay).toHaveCSS("animation-name", "enter")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(dialog).toHaveCSS("animation-name", "none")
  await expect(overlay).toHaveCSS("animation-name", "none")
  await dialog.getByRole("button", { name: "Close", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await start.click()
  await expect(dialog).toHaveCSS("animation-name", "none")
  await expect(dialog.getByRole("button", { name: "Keep the conversation" })).toBeFocused()
})

test("changing motion or visibility during speech rests only the visuals", async ({ page }) => {
  await mockRoom(page)
  // A deterministic, silent audio clock exercises the real rendering path.
  // It never contacts a provider or changes production playback code.
  await page.addInitScript(() => {
    const observed = window as typeof window & { visualTestVoice: { starts: number; stops: number } }
    observed.visualTestVoice = { starts: 0, stops: 0 }
    class SilentContext {
      currentTime = 0
      destination = {}
      async resume() {}
      async decodeAudioData() { return {} }
      createAnalyser() { return { frequencyBinCount: 1, getByteFrequencyData: (data: Uint8Array) => data.fill(64), connect() {} } }
      createBufferSource() {
        return {
          onended: () => {}, connect() {},
          start() { observed.visualTestVoice.starts++ },
          stop() { observed.visualTestVoice.stops++; this.onended() },
        }
      }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: SilentContext })
  })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  // An enabled SSR textarea does not prove hydration has attached its events.
  await expect(page.getByRole("region", { name: "The room", exact: true })).toHaveAttribute("aria-busy", "false")
  const input = page.getByRole("textbox", { name: "Message the room" })
  await input.fill("Steve, say hello.")
  await expect(input).toHaveValue("Steve, say hello.")
  await page.getByRole("button", { name: "Send message", exact: true }).click()
  const message = page.getByRole("article", { name: "Steve said" })
  const ahead = message.locator(".reading-ahead")
  // The orbs are drawn by a WebGL canvas with its own scheduler; the one thing
  // the room can observe about it is the switch the stage feeds it.
  const stage = page.locator(".agent-stage")
  const motion = () => stage.getAttribute("data-motion")
  const voiceState = () => page.evaluate(() => (window as typeof window & { visualTestVoice: { starts: number; stops: number } }).visualTestVoice)
  await expect(message.getByText("Speaking", { exact: true })).toBeVisible()
  await expect(ahead).not.toHaveText("")
  await expect.poll(motion).toBe("true")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(ahead).toHaveText("")
  await expect.poll(motion).toBe("false")
  expect(await voiceState()).toEqual({ starts: 1, stops: 0 })
  await expect(message.locator(".message-bubble")).toHaveText(reply)

  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(ahead).not.toHaveText("")
  await expect.poll(motion).toBe("true")
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(ahead).toHaveText("")
  await expect.poll(motion).toBe("false")
  expect(await voiceState()).toEqual({ starts: 1, stops: 0 })
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden")
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(ahead).not.toHaveText("")
  await expect.poll(motion).toBe("true")
  expect(await voiceState()).toEqual({ starts: 1, stops: 0 })
  await expect(message.getByText("Speaking", { exact: true })).toBeVisible()
})
