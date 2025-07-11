"use client"

import type { God } from "@arewesmite2yet/data/types"
import { type ColumnDef } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { GodImageHover } from "./GodImageHover"

function formatDate(dateString: string | null): string {
  if (!dateString) return ""
  try {
    const date = parseISO(dateString)
    return format(date, "MMM d, yyyy")
  } catch {
    return dateString
  }
}

export const columns: ColumnDef<God>[] = [
  {
    accessorKey: "name",
    header: "God",
    cell: ({ row }) => {
      const god = row.original
      return (
        <div className="flex items-center gap-3">
          <GodImageHover god={god} />
          <span className="font-medium">{god.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "pantheon",
    header: "Pantheon",
    cell: ({ row }) => {
      const pantheon = row.getValue("pantheon") as string

      // Map pantheons to emojis
      const pantheonEmojis: Record<string, string> = {
        Greek: "🏛️",
        Egyptian: "🔺",
        Norse: "⚡",
        Hindu: "🕉️",
        Chinese: "🐉",
        Roman: "🛡️",
        Maya: "🦎",
        Celtic: "🍀",
        Japanese: "⛩️",
        Arthurian: "⚔️",
        Babylonian: "🏺",
        Slavic: "🐻",
        Voodoo: "💀",
        Polynesian: "🌺",
        Yoruba: "🪘",
        Korean: "🎭",
        "Tales of Arabia": "🧞",
        "Great Old Ones": "🐙",
      }

      const emoji = pantheonEmojis[pantheon]

      return (
        <div className="flex items-center gap-2">
          {emoji ? (
            <span className="text-lg" title={pantheon}>
              {emoji}
            </span>
          ) : (
            <div className="w-5 h-5 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">
              ?
            </div>
          )}
          <span>{pantheon}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "class",
    header: "Class",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <span
          className={
            status === "ported"
              ? "text-green-400 font-semibold"
              : status === "exclusive"
                ? "text-purple-400 font-semibold"
                : "text-red-400 font-semibold"
          }
        >
          {status === "ported" ? "Ported" : status === "exclusive" ? "Exclusive" : "Not Ported"}
        </span>
      )
    },
    sortingFn: (rowA, rowB) => {
      const statusA = rowA.getValue("status") as string
      const statusB = rowB.getValue("status") as string

      // Priority: ported/exclusive first, then not_ported
      const priorityA = statusA === "not_ported" ? 0 : 1
      const priorityB = statusB === "not_ported" ? 0 : 1

      return priorityB - priorityA // Higher priority first
    },
    enableSorting: true,
  },
  {
    accessorKey: "portedDate",
    header: "Ported Date",
    cell: ({ row }) => {
      const portedDate = row.getValue("portedDate") as string
      return portedDate ? formatDate(portedDate) : ""
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = rowA.getValue(columnId) as string | null
      const b = rowB.getValue(columnId) as string | null

      // Treat null, undefined, and empty string as "no date"
      const aEmpty = !a
      const bEmpty = !b

      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1 // Put empty values last
      if (bEmpty) return -1

      return a.localeCompare(b)
    },
    enableSorting: true,
  },
  {
    accessorKey: "releaseDate",
    header: "Smite 1 Release Date",
    cell: ({ row }) => {
      const releaseDate = row.getValue("releaseDate") as string
      return formatDate(releaseDate)
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = rowA.getValue(columnId) as string | null
      const b = rowB.getValue(columnId) as string | null

      // Treat null, undefined, and empty string as "no date"
      const aEmpty = !a
      const bEmpty = !b

      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1 // Put empty values last
      if (bEmpty) return -1

      return a.localeCompare(b)
    },
    enableSorting: true,
  },
]
