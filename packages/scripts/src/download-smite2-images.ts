import { createWriteStream } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"
import type { God } from "@arewesmite2yet/data/types"
import axios from "axios"

interface Options {
  dryRun: boolean
  thumbnailsOnly: boolean
  imagesOnly: boolean
  godName?: string
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const godIndex = args.indexOf('--god')
  const godName = godIndex !== -1 && godIndex + 1 < args.length ? args[godIndex + 1] : undefined
  
  if (args.includes('--help')) {
    console.log(`
Usage: bun run download-smite2-images.ts [options]

Options:
  --dry-run           Preview mode - show what would be downloaded without downloading
  --thumbnails-only   Download only thumbnails
  --images-only       Download only full-size images  
  --god "God Name"    Process only the specified god
  --help              Show this help message

Examples:
  bun run download-smite2-images.ts --dry-run
  bun run download-smite2-images.ts --god "Scylla" --thumbnails-only
  bun run download-smite2-images.ts --god "Mercury" --dry-run
`)
    process.exit(0)
  }
  
  return {
    dryRun: args.includes('--dry-run'),
    thumbnailsOnly: args.includes('--thumbnails-only'),
    imagesOnly: args.includes('--images-only'),
    godName
  }
}

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

async function downloadSmite2ImagesAndThumbnails(): Promise<void> {
  try {
    const options = parseArgs()
    
    // Determine what to download
    const mode = options.thumbnailsOnly ? "thumbnails only" : 
                 options.imagesOnly ? "full-size images only" : 
                 "thumbnails and full-size images"
    
    const target = options.godName ? `for ${options.godName}` : "for all ported/exclusive gods"
    
    if (options.dryRun) {
      console.log("🏃‍♂️ DRY RUN MODE - No files will be downloaded")
    }
    
    console.log(`🔍 Downloading ${mode} ${target} from https://wiki.smite2.com/`)

    // Read gods data
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Create directories
    const smite2ThumbnailsDir = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "images",
      "gods",
      "smite2",
      "thumb"
    )
    const smite2ImagesDir = join(process.cwd(), "..", "web", "public", "images", "gods", "smite2", "card")
    await mkdir(smite2ThumbnailsDir, { recursive: true })
    await mkdir(smite2ImagesDir, { recursive: true })

    const updatedGods: God[] = []
    let downloadedThumbnails = 0
    let downloadedImages = 0

    // Filter gods if specific god requested
    const godsToProcess = options.godName 
      ? gods.filter(god => god.name.toLowerCase() === options.godName!.toLowerCase())
      : gods.filter(god => god.status === "ported" || god.status === "exclusive")

    // Add non-processed gods to the updated list if filtering by god name
    if (options.godName) {
      updatedGods.push(...gods.filter(god => god.name.toLowerCase() !== options.godName!.toLowerCase()))
    }

    // Process each god that is ported or exclusive
    for (const god of godsToProcess) {

      let thumbnailUrl: string | null = null
      let imageUrl: string | null = null

      // Try to construct URLs for both thumbnail and full-size image
      const godNameVariations = [
        god.name.replace(/[^a-zA-Z0-9]/g, ""), // Remove all non-alphanumeric
        god.name.replace(/\s+/g, ""), // Remove spaces
        god.name.replace(/['\s]/g, ""), // Remove apostrophes and spaces
        god.name.replace(/[^a-zA-Z]/g, ""), // Remove all non-letters
        god.name.replace(/\s+/g, "_"), // Replace spaces with underscores
        god.name
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_"), // Remove special chars, spaces to underscores
      ]

      // Special name mappings
      const specialNames: Record<string, string> = {
        "Ah Muzen Cab": "AhMuzenCab",
        "Ah Puch": "AhPuch",
        "Chang'e": "Change",
        "Cu Chulainn": "CuChulainn",
        "Da Ji": "DaJi",
        "Erlang Shen": "ErlangShen",
        "Guan Yu": "Guan_Yu",
        "He Bo": "HeBo",
        "Hou Yi": "HouYi",
        "Hun Batz": "Hun_Batz",
        "Ix Chel": "IxChel",
        "Jing Wei": "JingWei",
        "King Arthur": "KingArthur",
        "Maman Brigitte": "MamanBrigitte",
        "Morgan Le Fay": "MorganLeFay",
        "Ne Zha": "NeZha",
        "Nu Wa": "Nu_Wa",
        "Sun Wukong": "SunWukong",
        "The Morrigan": "The_Morrigan",
        "Xing Tian": "XingTian",
        "Yu Huang": "YuHuang",
        "Zhong Kui": "ZhongKui",
        "Baron Samedi": "Baron_Samedi",
        "Baba Yaga": "BabaYaga",
        "Bake Kujira": "BakeKujira",
        "Princess Bari": "Princess_Bari",
      }

      const specialName = specialNames[god.name]
      if (specialName) {
        godNameVariations.unshift(specialName)
      }

      // Try to find both thumbnail icon and full-size image
      for (const nameVariation of godNameVariations) {
        // For thumbnails: T_NameS2_Default_Icon.png or T_Name_Default_Icon.png
        const thumbnailS2Url = `/images/T_${nameVariation}%28S2%29_Default_Icon.png`
        const thumbnailNoS2Url = `/images/T_${nameVariation}_Default_Icon.png`

        // For full-size images: T_NameS2_Default.png or T_Name_Default.png
        const imageS2Url = `/images/T_${nameVariation}S2_Default.png`
        const imageNoS2Url = `/images/T_${nameVariation}_Default.png`

        // Test thumbnail URLs (unless images-only mode)
        if (!thumbnailUrl && !options.imagesOnly) {
          for (const testUrl of [thumbnailS2Url, thumbnailNoS2Url]) {
            try {
              const testResponse = await axios.head(`https://wiki.smite2.com${testUrl}`, {
                timeout: 5000,
              })
              if (testResponse.status === 200) {
                thumbnailUrl = testUrl
                console.log(`✅ Found thumbnail for ${god.name}: ${testUrl}`)
                break
              }
            } catch (_error) {
              // Icon doesn't exist, continue
            }
          }
        }

        // Test full-size image URLs (unless thumbnails-only mode)
        if (!imageUrl && !options.thumbnailsOnly) {
          for (const testUrl of [imageS2Url, imageNoS2Url]) {
            try {
              const testResponse = await axios.head(`https://wiki.smite2.com${testUrl}`, {
                timeout: 5000,
              })
              if (testResponse.status === 200) {
                imageUrl = testUrl
                console.log(`✅ Found full-size image for ${god.name}: ${testUrl}`)
                break
              }
            } catch (_error) {
              // Image doesn't exist, continue
            }
          }
        }

        if (thumbnailUrl && imageUrl) break
      }

      console.log(`\n🔍 Processing ${god.name}...`)

      const filename = `${god.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`
      const thumbnailPath = join(smite2ThumbnailsDir, filename)
      const imagePath = join(smite2ImagesDir, filename)

      const updatedGod = { ...god }

      // Download thumbnail if found
      if (thumbnailUrl) {
        if (options.dryRun) {
          console.log(`📋 Would download thumbnail: https://wiki.smite2.com${thumbnailUrl}`)
        } else {
          try {
            // Check if file already exists
            try {
              await readFile(thumbnailPath)
              console.log(`⏭️  Thumbnail already exists for ${god.name}`)
            } catch (_error) {
              // File doesn't exist, download it
              const fullThumbnailUrl = `https://wiki.smite2.com${thumbnailUrl}`
              await downloadImage(fullThumbnailUrl, thumbnailPath)
              downloadedThumbnails++
            }

            updatedGod.smite2ThumbnailPath = `/images/gods/smite2/thumb/${filename}`
          } catch (_error) {
            console.warn(`⚠️  Could not download thumbnail for ${god.name}`)
          }
        }
      }

      // Download full-size image if found
      if (imageUrl) {
        if (options.dryRun) {
          console.log(`📋 Would download full-size image: https://wiki.smite2.com${imageUrl}`)
        } else {
          try {
            // Check if file already exists
            try {
              await readFile(imagePath)
              console.log(`⏭️  Full-size image already exists for ${god.name}`)
            } catch (_error) {
              // File doesn't exist, download it
              const fullImageUrl = `https://wiki.smite2.com${imageUrl}`
              await downloadImage(fullImageUrl, imagePath)
              downloadedImages++
            }

            updatedGod.imagePath = `/images/gods/smite2/card/${filename}`
          } catch (_error) {
            console.warn(`⚠️  Could not download full-size image for ${god.name}`)
          }
        }
      }

      updatedGods.push(updatedGod)

      // Small delay to be respectful
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (options.dryRun) {
      console.log("\n📋 DRY RUN - gods.json was not updated")
    } else {
      // Update gods.json
      const jsonData = JSON.stringify(updatedGods, null, 2)
      await writeFile(godsPath, jsonData, "utf8")
    }

    console.log("\n✅ All Smite 2 images and thumbnails download complete!")
    const prefix = options.dryRun ? "Would download" : "Downloaded"
    console.log(
      `📊 ${prefix}: ${downloadedThumbnails} new thumbnails, ${downloadedImages} new images`
    )
    console.log(
      `🎯 Total with Smite 2 content: ${updatedGods.filter((god) => god.smite2ThumbnailPath || god.imagePath).length}`
    )
  } catch (error) {
    console.error("❌ Error downloading Smite 2 images and thumbnails:", error)
    throw error
  }
}

if (import.meta.main) {
  downloadSmite2ImagesAndThumbnails()
}
