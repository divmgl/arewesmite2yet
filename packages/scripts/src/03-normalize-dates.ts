import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { God } from "@arewesmite2yet/data/types"
import { format, isValid, parse } from "date-fns"

// Common date formats found in the scraped data
const dateFormats = [
  "MMMM d, yyyy", // "May 2, 2024"
  "MMMM dd, yyyy", // "May 02, 2024"
  "d MMMM, yyyy", // "2 May, 2024"
  "dd MMMM, yyyy", // "02 May, 2024"
  "yyyy-MM-dd", // "2024-05-02"
  "MMMM d", // "May 2" (assumes current year)
  "MMMM dd", // "May 02" (assumes current year)
  "MMMM do, yyyy", // "May 2nd, 2024"
  "MMMM do yyyy", // "May 2nd 2024"
  "MMMM yyyy", // "May 2024" (assumes first of month)
]

function parseFlexibleDate(dateString: string): Date | null {
  if (
    !dateString ||
    dateString.toLowerCase().includes("missing") ||
    dateString.toLowerCase().includes("unreleased") ||
    dateString.trim() === ""
  ) {
    return null
  }

  // Clean up the date string
  const cleanDate = dateString
    .trim()
    .replace(/\.$/, "") // Remove trailing period
    .replace(/(\d+)(st|nd|rd|th)/g, "$1") // Remove ordinal suffixes

  // Try parsing with various formats
  for (const formatString of dateFormats) {
    try {
      const parsed = parse(cleanDate, formatString, new Date())
      if (isValid(parsed)) {
        return parsed
      }
    } catch (_error) {
      // Continue to next format
    }
  }

  // Try native Date parsing as last resort
  const nativeDate = new Date(cleanDate)
  if (isValid(nativeDate)) {
    return nativeDate
  }

  console.warn(`Could not parse date: "${dateString}"`)
  return null
}

function formatToStandardDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

async function normalizeDates(): Promise<void> {
  try {
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    console.log("🔄 Normalizing dates...")

    const updatedGods = gods.map((god) => {
      const updatedGod = { ...god }

      // Normalize releaseDate (Smite 1 release date)
      if (god.releaseDate) {
        const parsedDate = parseFlexibleDate(god.releaseDate)
        if (parsedDate) {
          updatedGod.releaseDate = formatToStandardDate(parsedDate)
        }
      }

      // Normalize portedDate (Smite 2 release date)
      if (god.portedDate) {
        const parsedDate = parseFlexibleDate(god.portedDate)
        if (parsedDate) {
          updatedGod.portedDate = formatToStandardDate(parsedDate)
        } else {
          // Keep original if we can't parse it (for "missing", "unreleased", etc.)
          updatedGod.portedDate = god.portedDate
        }
      }

      return updatedGod
    })

    // Save updated data
    const jsonData = JSON.stringify(updatedGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    console.log("✅ Date normalization complete!")

    // Show some stats
    const normalizedPortedDates = updatedGods.filter((god) =>
      god.portedDate?.match(/^\d{4}-\d{2}-\d{2}$/)
    ).length
    const totalPortedGods = updatedGods.filter((god) => god.portedDate).length

    console.log(`📊 Normalized ${normalizedPortedDates}/${totalPortedGods} ported dates`)
  } catch (error) {
    console.error("❌ Error normalizing dates:", error)
    throw error
  }
}

if (import.meta.main) {
  normalizeDates()
}
