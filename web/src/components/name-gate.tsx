"use client"

import { useState } from "react"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useKeyboardFocus } from "@/hooks/use-keyboard-focus"
import { playerName, refusal } from "@/lib/player"

/**
 * The first thing the room asks, and the last time it asks.
 *
 * The name was already the price of sending a line — the composer refuses
 * without one — but the only thing that said so was a placeholder in a title
 * that reads as a heading. Somebody arriving for the first time saw a disabled
 * send button and no reason for it. So the question comes first, in the open,
 * with the reason attached: the agents read the name on the line, and it is how
 * they know which question is yours to answer.
 *
 * Asked once. From here the name is the room's, the transcript's and the prefix
 * every agent reads, so no later screen has any excuse to ask for it a second
 * time.
 *
 * Closable, never a trap. Closing it leaves exactly the room that existed
 * before this dialog did: the title is still a field, and the composer still
 * says what it is waiting for.
 */
export function NameGate({ agents, claim, dismiss }: {
  agents: readonly string[]
  claim: (name: string) => void
  dismiss: () => void
}) {
  const keyboardFocus = useKeyboardFocus<HTMLInputElement>()
  const [draft, setDraft] = useState("")
  const [problem, setProblem] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const typed = draft.trim()
    const claimed = playerName(typed, agents)
    // A refused name stays in the field with the reason under it — taking Steve
    // is the common one, and "Steve is already in the room" is the only answer
    // that tells the person what to type instead.
    if (!claimed) { setProblem(refusal(typed, agents) ?? "Letters, numbers and spaces."); return }
    claim(claimed)
  }

  // Written out rather than joined with commas alone: these are the three
  // voices in this particular room, and naming them is the point of the ask.
  const room = agents.length > 1 ? `${agents.slice(0, -1).join(", ")} and ${agents.at(-1)}` : agents[0] ?? "The agents"

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent className="room-dialog" showCloseButton={false} onOpenAutoFocus={(event) => {
        // The field is the whole dialog. Focus it without scrolling: the room
        // behind is a fixed surface and must not move under the keyboard.
        event.preventDefault()
        ;(event.currentTarget as HTMLElement).querySelector("input")?.focus({ preventScroll: true })
      }}>
        <DialogClose asChild><Button variant="ghost" size="icon" className="dialog-close" aria-label="Close"><XIcon /></Button></DialogClose>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-[21px] font-medium tracking-[-.6px]">What should they call you?</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">{room} read the name on every line. Yours is how they know a question is for you, and what they call you when they answer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-2 text-left">
          <Label htmlFor="player-name">Your name</Label>
          <Input
            {...keyboardFocus}
            id="player-name"
            className="h-12 rounded-xl text-base"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setProblem(null) }}
            maxLength={24}
            autoComplete="nickname"
            spellCheck={false}
            enterKeyHint="done"
            required
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "player-name-problem" : undefined}
          />
          {problem && <p id="player-name-problem" role="alert" className="text-muted-foreground text-xs">{problem}</p>}
          <Button size="lg" className="mt-3 h-12 w-full rounded-xl" disabled={!draft.trim()}>Enter the room</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
