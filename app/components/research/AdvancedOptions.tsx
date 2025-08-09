"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type RenderMode = "2d" | "3d"
type OutputKind = "svg" | "png"

interface AdvancedOptionsProps {
  width: number
  height: number
  setWidth: (n: number) => void
  setHeight: (n: number) => void
  modes: RenderMode[]
  setModes: (m: RenderMode[]) => void
  outputs: OutputKind[]
  setOutputs: (o: OutputKind[]) => void
  aspectLocked: boolean
  setAspectLocked: (b: boolean) => void
}

export function AdvancedOptions(props: AdvancedOptionsProps) {
  const {
    width,
    height,
    setWidth,
    setHeight,
    modes,
    setModes,
    outputs,
    setOutputs,
    aspectLocked,
    setAspectLocked,
  } = props

  const [open, setOpen] = React.useState(false)

  const toggleArray = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]

  const handleSetWidth = (val: number) => {
    const clamped = Math.max(64, Math.min(4096, val || 0))
    if (aspectLocked && height > 0) {
      const ratio = height / Math.max(1, width)
      const nextHeight = Math.round(clamped * ratio)
      setWidth(clamped)
      setHeight(nextHeight)
    } else {
      setWidth(clamped)
    }
  }

  const handleSetHeight = (val: number) => {
    const clamped = Math.max(64, Math.min(4096, val || 0))
    if (aspectLocked && width > 0) {
      const ratio = width / Math.max(1, height)
      const nextWidth = Math.round(clamped * ratio)
      setHeight(clamped)
      setWidth(nextWidth)
    } else {
      setHeight(clamped)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium">Advanced options</span>
        <span className="text-xs opacity-70">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Width (px)</label>
              <Input
                type="number"
                value={width}
                min={64}
                max={4096}
                onChange={e => handleSetWidth(parseInt(e.target.value || "0", 10))}
                className="bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Height (px)</label>
              <Input
                type="number"
                value={height}
                min={64}
                max={4096}
                onChange={e => handleSetHeight(parseInt(e.target.value || "0", 10))}
                className="bg-white text-gray-900"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <Switch checked={aspectLocked} onCheckedChange={setAspectLocked} />
                Lock aspect ratio
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Presets</div>
            <div className="flex flex-wrap gap-2">
              {[512, 1024, 2048].map(p => (
                <Button key={p} type="button" size="sm" variant="outline" onClick={() => {
                  const ratio = height / Math.max(1, width)
                  const nextW = p
                  const nextH = aspectLocked ? Math.round(p * ratio) : height
                  setWidth(nextW)
                  setHeight(nextH)
                }}>
                  {p} px
                </Button>
              ))}
              {[[1,1,"1:1"],[16,9,"16:9"],[4,3,"4:3"]].map(([w,h,label]) => (
                <Button key={String(label)} type="button" size="sm" variant="ghost" onClick={() => {
                  const area = width * height
                  const ratio = Number(w) / Number(h)
                  const nextW = Math.round(Math.sqrt(area * ratio))
                  const nextH = Math.round(nextW / ratio)
                  setWidth(nextW)
                  setHeight(nextH)
                }}>
                  {String(label)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-2">Render modes</div>
              <div className="flex flex-wrap gap-2">
                {(["2d","3d"] as RenderMode[]).map(m => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={modes.includes(m) ? "secondary" : "outline"}
                    onClick={() => setModes(toggleArray(modes, m))}
                  >
                    {m.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Outputs</div>
              <div className="flex flex-wrap gap-2">
                {(["svg","png"] as OutputKind[]).map(o => (
                  <Button
                    key={o}
                    type="button"
                    size="sm"
                    variant={outputs.includes(o) ? "secondary" : "outline"}
                    onClick={() => setOutputs(toggleArray(outputs, o))}
                  >
                    {o.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


