import { createWriteStream } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"
import type { God } from "@arewesmite2yet/data/types"
import axios from "axios"
import * as cheerio from "cheerio"
import pLimit from "p-limit"

async function downloadImage(url: string, filepath: string): Promise<void> {
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 15000,
    })

    await pipeline(response.data, createWriteStream(filepath))
    console.log(`✅ Downloaded: ${filepath}`)
  } catch (error) {
    console.error(`❌ Failed to download ${url}:`, error)
    throw error
  }
}

interface Options {
  dryRun: boolean
  thumbnailsOnly: boolean
  cardsOnly: boolean
  godName?: string
}

function parseArgs(): Options {
  const args = process.argv.slice(2)

  if (args.includes("--help")) {
    console.log(`
Usage: bun run src/download-smite1-images.ts [options]

Options:
  --dry-run             Show what would be downloaded without actually downloading
  --thumbnails-only     Download only thumbnails (36x36 pixel icons)
  --cards-only          Download only full-size cards
  --god "God Name"      Download only for specific god (use quotes for multi-word names)
  --help               Show this help message

Examples:
  bun run src/download-smite1-images.ts --dry-run --thumbnails-only
  bun run src/download-smite1-images.ts --thumbnails-only
  bun run src/download-smite1-images.ts --god "Ah Muzen Cab" --thumbnails-only
  bun run src/download-smite1-images.ts --god "Ah Puch" --dry-run
    `)
    process.exit(0)
  }

  const godIndex = args.indexOf("--god")
  const godName = godIndex !== -1 && godIndex + 1 < args.length ? args[godIndex + 1] : undefined

  return {
    dryRun: args.includes("--dry-run"),
    thumbnailsOnly: args.includes("--thumbnails-only"),
    cardsOnly: args.includes("--cards-only"),
    godName,
  }
}

async function downloadSmite1Images(): Promise<void> {
  try {
    const options = parseArgs()

    if (options.dryRun) {
      console.log("🏃‍♂️ DRY RUN MODE - No files will be downloaded")
    }

    let mode = "thumbnails and full cards"
    if (options.thumbnailsOnly) mode = "thumbnails only"
    if (options.cardsOnly) mode = "full cards only"

    const target = options.godName ? `for ${options.godName}` : "for all gods"
    console.log(`🔍 Downloading ${mode} ${target} from https://smite.fandom.com/`)

    // Read gods data
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Create directories
    const smite1ThumbnailsDir = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "images",
      "gods",
      "smite1",
      "thumb"
    )
    const smite1CardsDir = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "images",
      "gods",
      "smite1",
      "card"
    )
    await mkdir(smite1ThumbnailsDir, { recursive: true })
    await mkdir(smite1CardsDir, { recursive: true })

    const updatedGods: God[] = []
    let downloadedThumbnails = 0
    let downloadedCards = 0

    // Filter gods if specific god requested
    const godsToProcess = options.godName
      ? gods.filter((god) => god.name.toLowerCase() === options.godName?.toLowerCase())
      : gods

    if (options.godName && godsToProcess.length === 0) {
      console.error(`❌ God "${options.godName}" not found in database`)
      return
    }

    // Cache the main wiki page once for all gods
    console.log(`🔍 Fetching main Smite Wiki page for icon data...`)
    const wikiPageUrl = `https://smite.fandom.com/wiki/Smite_Wiki`
    const wikiPageResponse = await axios.get(wikiPageUrl, { timeout: 10000 })
    const wikiPageHtml = wikiPageResponse.data
    const $ = cheerio.load(wikiPageHtml)
    console.log(`✅ Main wiki page cached successfully`)

    // Set up concurrency limit to avoid overwhelming the server
    const limit = pLimit(5) // Process up to 5 gods concurrently

    // Process all gods in parallel with concurrency limit
    const processGod = async (
      god: God
    ): Promise<{
      god: God
      updatedGod: God
      downloadedThumbnail: boolean
      downloadedCard: boolean
    }> => {
      console.log(`🔍 Processing ${god.name}...`)

      // Generate possible name variations for Smite 1 image URLs
      const godNameVariations = [
        god.name,
        god.name.replace(/\s+/g, "_"), // Replace spaces with underscores
        god.name.replace(/[^a-zA-Z0-9]/g, ""), // Remove all non-alphanumeric
        god.name.replace(/\s+/g, ""), // Remove spaces
        god.name.replace(/[']/g, ""), // Remove apostrophes
      ]

      // Special name mappings for Smite 1 wiki (based on research)
      const specialNames: Record<string, string> = {
        "Ah Muzen Cab": "AMC",
        "Ah Puch": "AhPuch",
        "Chang'e": "Change",
        "Cu Chulainn": "CuChulainn",
        "Da Ji": "DaJi",
        "Erlang Shen": "ErlangShen",
        "Guan Yu": "GuanYu",
        "He Bo": "HeBo",
        "Hou Yi": "HouYi",
        "Hun Batz": "HunBatz",
        "Ix Chel": "IxChel",
        "Jing Wei": "JingWei",
        "King Arthur": "KingArthur",
        "Maman Brigitte": "MamanBrigitte",
        "Morgan Le Fay": "MorganLeFay",
        "Ne Zha": "NeZha",
        "Nu Wa": "NuWa",
        "Sun Wukong": "SunWukong",
        "The Morrigan": "TheMorrigan",
        "Xing Tian": "XingTian",
        "Yu Huang": "YuHuang",
        "Zhong Kui": "ZhongKui",
        "Baron Samedi": "BaronSamedi",
        "Baba Yaga": "BabaYaga",
        "Bake Kujira": "BakeKujira",
        "Princess Bari": "PrincessBari",
      }

      const specialName = specialNames[god.name]
      if (specialName) {
        godNameVariations.unshift(specialName)
      }

      let thumbnailUrl: string | null = null
      let cardUrl: string | null = null

      // Search cached wiki page for this god's images
      $("img[data-image-key]").each((_, img) => {
        const imageKey = $(img).attr("data-image-key")
        const dataSrc = $(img).attr("data-src")

        if (imageKey && dataSrc) {
          // Look for Default_Icon.png files
          if (imageKey.includes("_Default_Icon.png") && !thumbnailUrl) {
            // Extract the base URL without scaling parameters
            const baseUrl = dataSrc.split("/revision/latest")[0]
            const fullUrl = `${baseUrl}/revision/latest`

            // Check if this matches our god
            const godNameVariationsLower = godNameVariations.map((name) =>
              name.toLowerCase().replace(/[^a-z0-9]/g, "")
            )
            const iconNamePart = imageKey
              .toLowerCase()
              .replace("t_", "")
              .replace("_default_icon.png", "")

            if (
              godNameVariationsLower.some(
                (variation) =>
                  variation === iconNamePart ||
                  iconNamePart.includes(variation) ||
                  variation.includes(iconNamePart)
              )
            ) {
              thumbnailUrl = fullUrl
              console.log(`✅ Found thumbnail for ${god.name}: ${thumbnailUrl}`)
            }
          }

          // Look for Default_Card.png files
          if (imageKey.includes("_Default_Card.png") && !cardUrl) {
            // Extract the base URL without scaling parameters
            const baseUrl = dataSrc.split("/revision/latest")[0]
            const fullUrl = `${baseUrl}/revision/latest`

            // Check if this matches our god
            const godNameVariationsLower = godNameVariations.map((name) =>
              name.toLowerCase().replace(/[^a-z0-9]/g, "")
            )
            const cardNamePart = imageKey
              .toLowerCase()
              .replace("t_", "")
              .replace("_default_card.png", "")

            if (
              godNameVariationsLower.some(
                (variation) =>
                  variation === cardNamePart ||
                  cardNamePart.includes(variation) ||
                  variation.includes(cardNamePart)
              )
            ) {
              cardUrl = fullUrl
              console.log(`✅ Found card for ${god.name}: ${cardUrl}`)
            }
          }
        }
      })

      // If we didn't find direct URLs, try constructing them
      if (!thumbnailUrl || !cardUrl) {
        for (const nameVariation of godNameVariations) {
          // Test constructed URLs
          const testIconUrl = `https://static.wikia.nocookie.net/smite_gamepedia/images/T_${nameVariation}_Default_Icon.png`
          const testCardUrl = `https://static.wikia.nocookie.net/smite_gamepedia/images/T_${nameVariation}_Default_Card.png`

          if (!thumbnailUrl) {
            try {
              const testResponse = await axios.head(testIconUrl, { timeout: 5000 })
              if (testResponse.status === 200) {
                thumbnailUrl = testIconUrl
                console.log(`✅ Found constructed thumbnail for ${god.name}: ${thumbnailUrl}`)
              }
            } catch (_error) {
              // Continue trying other variations
            }
          }

          if (!cardUrl) {
            try {
              const testResponse = await axios.head(testCardUrl, { timeout: 5000 })
              if (testResponse.status === 200) {
                cardUrl = testCardUrl
                console.log(`✅ Found constructed card for ${god.name}: ${cardUrl}`)
              }
            } catch (_error) {
              // Continue trying other variations
            }
          }

          if (thumbnailUrl && cardUrl) break
        }
      }

      const filename = `${god.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`
      const thumbnailPath = join(smite1ThumbnailsDir, filename)
      const cardPath = join(smite1CardsDir, filename)

      const updatedGod = { ...god }
      let downloadedThumbnail = false
      let downloadedCard = false

      // Download thumbnail if found and not cards-only
      if (thumbnailUrl && !options.cardsOnly) {
        try {
          if (options.dryRun) {
            console.log(`📋 Would download thumbnail: ${thumbnailUrl}`)
            updatedGod.smite1ThumbnailPath = `/images/gods/smite1/thumb/${filename}`
          } else {
            // Check if file already exists
            try {
              await readFile(thumbnailPath)
              console.log(`⏭️  Thumbnail already exists for ${god.name}`)
            } catch (_error) {
              // File doesn't exist, download it
              await downloadImage(thumbnailUrl, thumbnailPath)
              downloadedThumbnail = true
            }

            updatedGod.smite1ThumbnailPath = `/images/gods/smite1/thumb/${filename}`
          }
        } catch (_error) {
          console.warn(`⚠️  Could not download thumbnail for ${god.name}`)
        }
      }

      // Download card if found and not thumbnails-only
      if (cardUrl && !options.thumbnailsOnly) {
        try {
          if (options.dryRun) {
            console.log(`📋 Would download card: ${cardUrl}`)
            updatedGod.smite1CardPath = `/images/gods/smite1/card/${filename}`
          } else {
            // Check if file already exists
            try {
              await readFile(cardPath)
              console.log(`⏭️  Card already exists for ${god.name}`)
            } catch (_error) {
              // File doesn't exist, download it
              await downloadImage(cardUrl, cardPath)
              downloadedCard = true
            }

            updatedGod.smite1CardPath = `/images/gods/smite1/card/${filename}`
          }
        } catch (_error) {
          console.warn(`⚠️  Could not download card for ${god.name}`)
        }
      }

      return { god, updatedGod, downloadedThumbnail, downloadedCard }
    }

    // Execute all god processing tasks with concurrency limit
    const results = await Promise.all(godsToProcess.map((god) => limit(() => processGod(god))))

    // Collect results
    for (const result of results) {
      if (result.downloadedThumbnail) downloadedThumbnails++
      if (result.downloadedCard) downloadedCards++

      if (options.godName) {
        // For single god, we need to update the full gods array
        const godIndex = gods.findIndex((g) => g.id === result.god.id)
        if (godIndex !== -1) {
          gods[godIndex] = result.updatedGod
        }
      } else {
        updatedGods.push(result.updatedGod)
      }
    }

    // Update gods.json (unless dry run)
    if (!options.dryRun) {
      const finalGods = options.godName ? gods : updatedGods
      const jsonData = JSON.stringify(finalGods, null, 2)
      await writeFile(godsPath, jsonData, "utf8")
    } else {
      console.log("\n📋 DRY RUN - gods.json was not updated")
    }

    console.log("\n✅ All Smite 1 images download complete!")
    if (options.dryRun) {
      console.log(
        `📊 Would download: ${updatedGods.filter((god) => god.smite1ThumbnailPath && !god.smite1ThumbnailPath.includes("smite1")).length} thumbnails, ${updatedGods.filter((god) => god.smite1CardPath && !god.smite1CardPath.includes("smite1")).length} cards`
      )
    } else {
      console.log(
        `📊 Downloaded: ${downloadedThumbnails} new thumbnails, ${downloadedCards} new cards`
      )
    }
    console.log(
      `🎯 Total with Smite 1 content: ${updatedGods.filter((god) => god.smite1ThumbnailPath || god.smite1CardPath).length}`
    )
  } catch (error) {
    console.error("❌ Error downloading Smite 1 images:", error)
    throw error
  }
}

if (import.meta.main) {
  downloadSmite1Images()
}
