import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import axios from "axios"
import * as cheerio from "cheerio"

interface God {
  id: number
  name: string
  pantheon: string
  class: string
  status: "ported" | "not_ported"
  releaseDate: string | null
  smite1Wiki?: string
  smite2Wiki?: string
}

async function scrapeSmiteGods(): Promise<God[]> {
  console.log("Fetching Smite gods from wiki...")

  try {
    const response = await axios.get("https://smite.fandom.com/wiki/List_of_gods")
    const $ = cheerio.load(response.data)

    const gods: God[] = []
    let id = 1

    // Debug: log what we're finding
    console.log("Looking for tables...")
    const tables = $("table")
    console.log(`Found ${tables.length} tables`)

    // Try multiple approaches to find the data
    let foundGods = false

    // Target the main table (usually first table with most rows)
    const mainTable = $("table").first()
    console.log(`Found main table with ${mainTable.find("tr").length} rows`)

    // Now extract the actual gods data
    mainTable.find("tr").each((_rowIndex, row) => {
      const cells = $(row).find("td")

      // Skip rows that don't have enough cells (header rows)
      if (cells.length < 10) return

      // Extract god name from cell 1 (link text)
      const nameCell = cells.eq(1)
      const name = nameCell.find("a").text().trim()

      // Extract pantheon from cell 2 (text content)
      const pantheonCell = cells.eq(2)
      const pantheon = pantheonCell.text().trim()

      // Extract class from cell 5 (text content)
      const classCell = cells.eq(5)
      const godClass = classCell.text().trim()

      // Extract release date from cell 9
      const releaseDateCell = cells.eq(9)
      const releaseDate = releaseDateCell.text().trim()

      // Validate we have all required fields
      if (
        name &&
        pantheon &&
        ["Mage", "Hunter", "Guardian", "Warrior", "Assassin"].includes(godClass)
      ) {
        gods.push({
          id: id++,
          name,
          pantheon,
          class: godClass,
          status: "not_ported",
          releaseDate: releaseDate || null,
          smite1Wiki: `https://smite.fandom.com/wiki/${name.replace(/\s+/g, "_")}`,
        })
        foundGods = true
      }
    })

    // Approach 2: If no table found, try other selectors
    if (!foundGods) {
      console.log("No gods found in tables, trying alternative selectors...")

      // Look for any links that might be god names
      $('a[href*="/wiki/"]').each((_i, link) => {
        const href = $(link).attr("href") || ""
        const text = $(link).text().trim()

        // Skip navigation, categories, etc.
        if (
          href.includes("Category:") ||
          href.includes("Template:") ||
          href.includes("File:") ||
          text.includes("edit") ||
          text.includes("Category") ||
          text.length < 3 ||
          text.length > 25
        ) {
          return
        }

        // Look for god-like page names
        if (href.match(/\/wiki\/[A-Z][a-z]+(?:_[A-Z][a-z]+)*$/)) {
          const parent = $(link).closest("tr, div, p")
          const parentText = parent.text()

          // Try to find pantheon and class context
          let pantheon = "Unknown"
          let godClass = "Unknown"

          // Check for pantheon keywords
          const pantheonKeywords = [
            "Greek",
            "Egyptian",
            "Norse",
            "Hindu",
            "Chinese",
            "Roman",
            "Maya",
            "Celtic",
            "Japanese",
            "Arthurian",
            "Babylonian",
            "Slavic",
            "Voodoo",
            "Polynesian",
            "Yoruba",
          ]
          const classKeywords = ["Mage", "Hunter", "Guardian", "Warrior", "Assassin"]

          for (const p of pantheonKeywords) {
            if (parentText.includes(p)) {
              pantheon = p
              break
            }
          }

          for (const c of classKeywords) {
            if (parentText.includes(c)) {
              godClass = c
              break
            }
          }

          if (pantheon !== "Unknown" && godClass !== "Unknown" && gods.length < 200) {
            gods.push({
              id: id++,
              name: text,
              pantheon,
              class: godClass,
              status: "not_ported",
              releaseDate: null,
            })
            console.log(`Added god from link: ${text} (${pantheon}, ${godClass})`)
          }
        }
      })
    }

    console.log(`Scraped ${gods.length} gods from Smite wiki`)
    return gods
  } catch (error) {
    console.error("Error scraping gods:", error)
    throw error
  }
}

async function saveGodsToFile(gods: God[], outputPath: string): Promise<void> {
  try {
    // Ensure directory exists
    const dir = join(outputPath, "..")
    await mkdir(dir, { recursive: true })

    const jsonData = JSON.stringify(gods, null, 2)
    await writeFile(outputPath, jsonData, "utf8")
    console.log(`Saved ${gods.length} gods to ${outputPath}`)
  } catch (error) {
    console.error("Error saving gods to file:", error)
    throw error
  }
}

async function main() {
  try {
    const gods = await scrapeSmiteGods()

    // Save to data package only
    const dataPackagePath = join(process.cwd(), "..", "data", "gods.json")
    await saveGodsToFile(gods, dataPackagePath)

    console.log("✅ Successfully scraped and saved gods data")
  } catch (error) {
    console.error("❌ Script failed:", error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
