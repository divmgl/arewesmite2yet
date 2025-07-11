"use client"

import type { God } from "@arewesmite2yet/data/types"
import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface GodImageHoverProps {
  god: God
}

export function GodImageHover({ god }: GodImageHoverProps) {
  const [open, setOpen] = useState(false)

  // Only use Smite 2 assets if the god is actually in Smite 2
  const isInSmite2 = god.status === "ported" || god.status === "exclusive"
  const smite2Thumbnail = isInSmite2 ? god.smite2ThumbnailPath : null
  const smite2Image = isInSmite2 ? god.imagePath : null

  // Get the thumbnail path (Smite 2 > Smite 1 thumbnail > Smite 1 card > legacy)
  const thumbnailPath = smite2Thumbnail || god.smite1ThumbnailPath || god.smite1CardPath || god.thumbnailPath

  // For full-size image (Smite 2 > Smite 1 card > thumbnail fallback)
  const fullSizePath = smite2Image || god.smite1CardPath || thumbnailPath

  if (!thumbnailPath) {
    return (
      <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">
        ?
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <img
            src={thumbnailPath}
            alt={god.name}
            className="w-10 h-10 object-cover rounded hover:ring-2 hover:ring-blue-500 transition-all"
            style={{
              imageRendering: "crisp-edges",
              filter: "none",
            }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-none p-2 border-0 bg-black/90 backdrop-blur-sm"
        side="top"
        align="center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        sideOffset={10}
        avoidCollisions={true}
      >
        <div className="flex flex-col items-center gap-2">
          <img
            src={fullSizePath}
            alt={god.name}
            className="rounded-lg shadow-lg"
            style={{
              imageRendering: "crisp-edges",
              filter: "none",
              maxWidth: "200px",
              width: "auto",
              height: "auto",
            }}
          />
          <div className="text-center">
            <h3 className="text-white font-semibold text-lg">{god.name}</h3>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
