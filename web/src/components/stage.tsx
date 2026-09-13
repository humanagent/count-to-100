"use client"

import { memo } from "react"
import dynamic from "next/dynamic"
import { useMotion } from "@/hooks/use-motion"
import { colorsFor } from "@/lib/agent-colors"
import { seedFor } from "@/lib/seed"

/**
 * Loaded after the room, not with it. The orb brings Three.js — 400KB gzipped,
 * two thirds of the page — for a decoration, and a transcript that waits on a
 * shader library before it can show a line is the wrong order. The stage keeps
 * its size while the chunk is on its way; the orbs fade in when it lands.
 */
const Orb = dynamic(() => import("@/components/ui/orb").then((module) => module.Orb), { ssr: false })

export type Phase = "listening" | "thinking" | "quiet" | "speaking" | "unreachable"
const captions: Record<Phase, string> = { listening: "Listening", thinking: "Thinking", quiet: "Listening", speaking: "Speaking", unreachable: "Unavailable" }

/**
 * Three orbs, one per agent, each drawn by ElevenLabs UI's `Orb`.
 *
 * The orb takes the agent's state and, while it is speaking, the loudness of
 * what it is saying, and animates itself from those. Nothing here draws; this
 * decides what each orb is told. `quiet` and `unreachable` are handed over as
 * no state at all, which the orb renders as a still surface — an agent that
 * decided a line was not for it should look like it is not doing anything.
 *
 * The canvas is told not to draw while the tab is hidden or motion is
 * reduced. It has its own frame scheduler, so the loop that pauses the rest of
 * the room's motion cannot reach it; the prop can.
 */
export const Stage = memo(function Stage({ names, phase, level }: { names: string[]; phase: Record<string, Phase>; level: () => number }) {
  const motion = useMotion()
  return (
    <div className="agent-stage" aria-label="Agents in the room" data-motion={motion}>
      {names.map((name, index) => {
        const state = phase[name] ?? "listening"
        const [light, color] = colorsFor(name)
        return (
          <figure className="agent" data-phase={state} key={name} style={{ animationDelay: `${index * -1.8}s` }}>
            <div className="agent-orbit">
              <div className="agent-halo" />
              <div className="agent-sphere">
                <Orb
                  colors={[color, light]}
                  seed={seedFor(name)}
                  frameloop={motion ? "always" : "demand"}
                  agentState={state === "speaking" ? "talking" : state === "thinking" ? "thinking" : state === "listening" ? "listening" : null}
                  volumeMode={state === "speaking" ? "manual" : "auto"}
                  getOutputVolume={state === "speaking" ? level : undefined}
                />
              </div>
            </div>
            <figcaption><span className="agent-name">{name}</span><span className="agent-caption">{state === "speaking" && <span className="voice-bars" aria-hidden="true"><i /><i /><i /></span>}{captions[state]}</span></figcaption>
          </figure>
        )
      })}
    </div>
  )
})
