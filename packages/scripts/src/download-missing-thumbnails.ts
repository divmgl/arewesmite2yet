import { createWriteStream } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"
import type { God } from "@arewesmite2yet/data/types"
import axios from "axios"

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

async function downloadMissingThumbnails(): Promise<void> {
  try {
    // Read gods data
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Create Smite 2 thumbnails directory
    const smite2ThumbnailsDir = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "images",
      "thumbnails",
      "smite2"
    )
    await mkdir(smite2ThumbnailsDir, { recursive: true })

    console.log("🖼️  Downloading missing Smite 2 thumbnails...")

    // Define the missing gods with their correct thumbnail URLs (35px versions)
    const missingGods = [
      {
        name: "Baron Samedi",
        url: "https://wiki.smite2.com/images/thumb/T_BaronSamediS2_Default.png/35px-T_BaronSamediS2_Default.png",
        filename: "baron_samedi.png",
      },
      {
        name: "Ganesha",
        url: "https://wiki.smite2.com/images/thumb/GodCard_Ganesha.png/35px-GodCard_Ganesha.png",
        filename: "ganesha.png",
      },
      {
        name: "Guan Yu",
        url: "https://wiki.smite2.com/images/thumb/GodCard_Guan_Yu.png/35px-GodCard_Guan_Yu.png",
        filename: "guan_yu.png",
      },
      {
        name: "Hun Batz",
        url: "https://wiki.smite2.com/images/thumb/T_HunBatzS2_Default.png/35px-T_HunBatzS2_Default.png",
        filename: "hun_batz.png",
      },
      {
        name: "Nu Wa",
        url: "https://wiki.smite2.com/images/thumb/T_NuWaS2_Default.png/35px-T_NuWaS2_Default.png",
        filename: "nu_wa.png",
      },
      {
        name: "The Morrigan",
        url: "https://wiki.smite2.com/images/thumb/GodCard_The_Morrigan.png/35px-GodCard_The_Morrigan.png",
        filename: "the_morrigan.png",
      },
      {
        name: "Princess Bari",
        url: "https://wiki.smite2.com/images/thumb/GodCard_Princess_Bari.png/35px-GodCard_Princess_Bari.png",
        filename: "princess_bari.png",
      },
    ]

    const updatedGods: God[] = []
    let downloadedCount = 0

    for (const god of gods) {
      const missingGod = missingGods.find((mg) => mg.name === god.name)

      if (missingGod) {
        console.log(`\\n🔍 Processing ${god.name}...`)

        const filepath = join(smite2ThumbnailsDir, missingGod.filename)

        // Check if file already exists
        try {
          await readFile(filepath)
          console.log(`⏭️  Thumbnail already exists for ${god.name}`)
          updatedGods.push({
            ...god,
            smite2ThumbnailPath: `/images/thumbnails/smite2/${missingGod.filename}`,
          })
          continue
        } catch (_error) {
          // File doesn't exist, download it
        }

        // Download the thumbnail
        try {
          await downloadImage(missingGod.url, filepath)
          downloadedCount++

          // Add thumbnail path to god data
          updatedGods.push({
            ...god,
            smite2ThumbnailPath: `/images/thumbnails/smite2/${missingGod.filename}`,
          })

          // Add a small delay to be respectful to the server
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (_error) {
          console.warn(`⚠️  Could not download thumbnail for ${god.name}`)
          updatedGods.push(god)
        }
      } else {
        // Keep existing god data unchanged
        updatedGods.push(god)
      }
    }

    // Update gods.json with thumbnail paths
    const jsonData = JSON.stringify(updatedGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    console.log("\\n✅ Missing thumbnail download complete!")
    console.log(`📊 Downloaded ${downloadedCount} new thumbnails`)
    console.log(
      `🎯 Total gods with Smite 2 thumbnails: ${updatedGods.filter((god) => god.smite2ThumbnailPath).length}`
    )
  } catch (error) {
    console.error("❌ Error downloading missing thumbnails:", error)
    throw error
  }
}

if (import.meta.main) {
  downloadMissingThumbnails()
}
