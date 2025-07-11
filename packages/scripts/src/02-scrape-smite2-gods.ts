import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { God, GodDetails } from "@arewesmite2yet/data/types"
import axios from "axios"
import * as cheerio from "cheerio"

async function scrapeSmite2Gods(): Promise<string[]> {
  console.log("Fetching Smite 2 gods from wiki...")

  try {
    const response = await axios.get("https://wiki.smite2.com/w/Gods")
    const $ = cheerio.load(response.data)

    const smite2Gods: string[] = []

    // Target specific god links: /w/[GodName] (not files, categories, etc.)
    $('a[href^="/w/"]').each((_i, link) => {
      const href = $(link).attr("href") || ""

      // Only process direct god page links (not files, categories, special pages)
      if (
        href.match(/^\/w\/[A-Z][a-zA-Z_']+$/) ||
        href.match(/^\/w\/[A-Z][a-zA-Z_']+\s[A-Z][a-zA-Z_']+$/)
      ) {
        // Extract god name from URL
        const pathParts = href.split("/")
        const pageName = pathParts[pathParts.length - 1]
        if (!pageName) return
        const godName = pageName.replace(/_/g, " ").trim()

        // Skip obvious non-god pages
        const nonGodPages = [
          "Gods",
          "Items",
          "Game Modes",
          "Patch notes",
          "Gems",
          "SMITE 2",
          "Main Page",
          "Community",
          "Help",
          "Special",
          "Random",
          "Recent Changes",
          "Upload",
          "File",
          "Category",
          "Template",
          "User",
          "Talk",
          "Project",
          "MediaWiki",
          "System",
          "Interface",
          "Gadget",
          "Gadget definition",
        ]

        if (
          nonGodPages.includes(godName) ||
          godName.toLowerCase().includes("patch") ||
          godName.toLowerCase().includes("update") ||
          godName.toLowerCase().includes("news") ||
          godName.toLowerCase().includes("blog") ||
          godName.length < 3 ||
          godName.length > 25
        ) {
          return
        }

        // Add to list if not already present
        if (!smite2Gods.includes(godName)) {
          smite2Gods.push(godName)
          console.log(`Found Smite 2 god: ${godName}`)
        }
      }
    })

    console.log(`Found ${smite2Gods.length} gods in Smite 2`)
    return smite2Gods
  } catch (error) {
    console.error("Error scraping Smite 2 gods:", error)
    return []
  }
}

async function scrapeGodDetails(godName: string): Promise<GodDetails> {
  try {
    const url = `https://wiki.smite2.com/w/${godName.replace(/\s+/g, "_")}`
    console.log(`  Fetching: ${url}`)

    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let pantheon = "Unknown"
    let godClass = "Unknown"
    let portedDate = "Unknown"

    // Look for the infobox table specifically
    $("table.infobox").each((_i, table) => {
      $(table)
        .find("tr")
        .each((_j, row) => {
          const cells = $(row).find("th, td")
          if (cells.length >= 2) {
            const header = $(cells[0]).text().trim()
            const value = $(cells[1]).text().trim()

            if (header === "Pantheon:") {
              // Extract pantheon name, removing any extra characters
              const pantheonMatch = value.match(
                /\b(Greek|Egyptian|Norse|Hindu|Chinese|Roman|Maya|Celtic|Japanese|Arthurian|Babylonian|Slavic|Voodoo|Polynesian|Yoruba|Korean|Arabian|Tales of Arabia)\b/
              )
              if (pantheonMatch?.[1]) {
                pantheon = pantheonMatch[1]
              }
            } else if (header === "Roles:") {
              // Map roles to classes
              const roleMapping: Record<string, string> = {
                Solo: "Warrior",
                Jungle: "Assassin",
                Mid: "Mage",
                ADC: "Hunter",
                Carry: "Hunter",
                Support: "Guardian",
              }

              for (const [role, mappedClass] of Object.entries(roleMapping)) {
                if (value.includes(role)) {
                  godClass = mappedClass
                  break
                }
              }
            } else if (header === "Release date:") {
              // Extract release date for Smite 2
              portedDate = value.trim()
            }
          }
        })
    })

    // If still unknown, look in page categories (wgCategories in script tag)
    if (pantheon === "Unknown" || godClass === "Unknown") {
      const scriptContent = $.html()
      const categoriesMatch = scriptContent.match(/"wgCategories":\[(.*?)\]/)
      if (categoriesMatch?.[1]) {
        const categories = categoriesMatch[1]

        // Look for pantheon in categories
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
          "Korean",
          "Arabian",
        ]
        for (const p of pantheonKeywords) {
          if (categories.includes(`${p} gods`) && pantheon === "Unknown") {
            pantheon = p
          }
        }

        // Look for class hints in categories
        if (categories.includes("Solo gods") && godClass === "Unknown") {
          godClass = "Warrior"
        } else if (categories.includes("Jungle gods") && godClass === "Unknown") {
          godClass = "Assassin"
        } else if (categories.includes("Mid gods") && godClass === "Unknown") {
          godClass = "Mage"
        } else if (categories.includes("ADC gods") && godClass === "Unknown") {
          godClass = "Hunter"
        } else if (categories.includes("Support gods") && godClass === "Unknown") {
          godClass = "Guardian"
        }
      }
    }

    console.log(`  ${godName}: ${pantheon} ${godClass} (${portedDate})`)
    return { pantheon, class: godClass, portedDate }
  } catch (error) {
    console.error(`  Error fetching details for ${godName}:`, error)
    return { pantheon: "Unknown", class: "Unknown", portedDate: "Unknown" }
  }
}

async function updateGodsWithSmite2Status(): Promise<void> {
  try {
    // Read existing gods data
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Get Smite 2 gods
    const smite2Gods = await scrapeSmite2Gods()

    // Create a map of existing god names for quick lookup
    const existingGodNames = new Set(gods.map((god) => god.name.toLowerCase()))

    // Update gods with Smite 2 status and wiki links
    console.log(`\n🔍 Getting ported dates for existing gods...`)
    const updatedGods: God[] = []

    for (const god of gods) {
      const isPorted = smite2Gods.some(
        (s2God) =>
          s2God.toLowerCase() === god.name.toLowerCase() ||
          s2God.toLowerCase().includes(god.name.toLowerCase()) ||
          god.name.toLowerCase().includes(s2God.toLowerCase())
      )

      let portedDate: string | undefined

      if (isPorted) {
        // Find the matching Smite 2 god name
        const s2GodName = smite2Gods.find(
          (s2God) =>
            s2God.toLowerCase() === god.name.toLowerCase() ||
            s2God.toLowerCase().includes(god.name.toLowerCase()) ||
            god.name.toLowerCase().includes(s2God.toLowerCase())
        )

        if (s2GodName) {
          console.log(`Fetching ported date for: ${god.name} (${s2GodName})`)
          try {
            const response = await axios.get(
              `https://wiki.smite2.com/w/${s2GodName.replace(/\s+/g, "_")}`
            )
            const $ = cheerio.load(response.data)

            $("table.infobox").each((_i, table) => {
              $(table)
                .find("tr")
                .each((_j, row) => {
                  const cells = $(row).find("th, td")
                  if (cells.length >= 2) {
                    const header = $(cells[0]).text().trim()
                    const value = $(cells[1]).text().trim()

                    if (header === "Release date:") {
                      portedDate = value.trim()
                    }
                  }
                })
            })
          } catch (error) {
            console.error(`  Error fetching ported date for ${god.name}:`, error)
          }
        }
      }

      // If god has no Smite 1 release date but exists in Smite 2, it's exclusive
      const isExclusive = !god.releaseDate && isPorted

      updatedGods.push({
        ...god,
        status: isExclusive
          ? ("exclusive" as const)
          : isPorted
            ? ("ported" as const)
            : ("not_ported" as const),
        smite1Wiki: `https://smite.fandom.com/wiki/${god.name.replace(/\s+/g, "_")}`,
        smite2Wiki: isPorted
          ? `https://wiki.smite2.com/w/${god.name.replace(/\s+/g, "_")}`
          : undefined,
        portedDate: portedDate,
      })
    }

    // Find Smite 2 exclusives (gods that exist in Smite 2 but not in Smite 1)
    const smite2Exclusives = smite2Gods.filter((s2God) => {
      const s2GodLower = s2God.toLowerCase()
      return (
        !existingGodNames.has(s2GodLower) &&
        !updatedGods.some(
          (god) =>
            god.name.toLowerCase().includes(s2GodLower) ||
            s2GodLower.includes(god.name.toLowerCase())
        )
      )
    })

    // Get detailed info for Smite 2 exclusives
    console.log(`\n🔍 Getting details for ${smite2Exclusives.length} Smite 2 exclusives...`)
    let nextId = Math.max(...updatedGods.map((god) => god.id)) + 1
    const exclusiveGods: God[] = []

    for (const godName of smite2Exclusives) {
      console.log(`Fetching details for: ${godName}`)
      const godDetails = await scrapeGodDetails(godName)
      exclusiveGods.push({
        id: nextId++,
        name: godName,
        pantheon: godDetails.pantheon,
        class: godDetails.class,
        status: "exclusive" as const,
        releaseDate: null, // These are Smite 2 exclusives, so no Smite 1 release date
        smite2Wiki: `https://wiki.smite2.com/w/${godName.replace(/\s+/g, "_")}`,
        portedDate: godDetails.portedDate,
      })
    }

    // Combine original gods with exclusives
    const allGods = [...updatedGods, ...exclusiveGods]

    // Save updated data with all gods including exclusives
    const jsonData = JSON.stringify(allGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    const portedCount = allGods.filter((god) => god.status === "ported").length
    const notPortedCount = allGods.filter((god) => god.status === "not_ported").length

    console.log(`✅ Updated gods data:`)
    console.log(`   - ${portedCount} gods ported to Smite 2`)
    console.log(`   - ${notPortedCount} gods not yet ported`)
    console.log(`   - ${exclusiveGods.length} Smite 2 exclusives added`)
    console.log(`   - Total: ${allGods.length} gods`)

    if (exclusiveGods.length > 0) {
      console.log(`\n🆕 Smite 2 Exclusives:`)
      exclusiveGods.forEach((god) => console.log(`   - ${god.name}`))
    }
  } catch (error) {
    console.error("Error updating gods data:", error)
    throw error
  }
}

async function main() {
  try {
    await updateGodsWithSmite2Status()
    console.log("✅ Successfully updated gods with Smite 2 status")
  } catch (error) {
    console.error("❌ Script failed:", error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
