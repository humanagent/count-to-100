"use client"

import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * The one question worth interrupting somebody for.
 *
 * Clearing the room is not undoing a message. The transcript IS the context —
 * all three agents read the whole thing before deciding whether the last line
 * was theirs — so this deletes the conversation from three separate processes
 * and from every screen that has the room open, and nothing brings it back.
 *
 * The safe answer is the one under the cursor and the one in full ink. A
 * destructive action styled as the obvious default is how it gets pressed by
 * somebody who was answering a different question, so here the big button keeps
 * the conversation and the quiet one is the one that ends it, with the
 * consequence written on it rather than implied by its colour.
 */
export function ClearRoom({ clear, dismiss }: { clear: () => void; dismiss: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent className="room-dialog" showCloseButton={false} onOpenAutoFocus={(event) => {
        event.preventDefault()
        ;(event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-keep]")?.focus({ preventScroll: true })
      }}>
        <DialogClose asChild><Button variant="ghost" size="icon" className="dialog-close" aria-label="Close"><XIcon /></Button></DialogClose>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-[21px] font-medium tracking-[-.6px]">Clear the room?</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">
            Every line goes, for everyone here, and all three agents forget the conversation.
            They keep who they are; your name stays.
          </DialogDescription>
        </DialogHeader>
        <Button data-keep size="lg" className="h-12 w-full rounded-xl" onClick={dismiss}>Keep the conversation</Button>
        <Button variant="ghost" className="text-muted-foreground h-12 w-full text-xs" onClick={clear}>Clear it. This cannot be undone.</Button>
      </DialogContent>
    </Dialog>
  )
}
