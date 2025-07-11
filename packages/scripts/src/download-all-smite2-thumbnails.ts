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

async function extractAllThumbnailsFromSmite2Wiki(): Promise<void> {
  try {
    console.log("🔍 Downloading ALL full-size (256x256) thumbnails from https://wiki.smite2.com/")

    // Instead of scraping HTML, construct URLs directly for gods that are ported
    const _thumbnailUrls: string[] = []

    // Read gods data to match names
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Create directory
    const smite2ThumbnailsDir = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "images",
      "thumbnails",
      "smite2",
      "thumb"
    )
    await mkdir(smite2ThumbnailsDir, { recursive: true })

    const updatedGods: God[] = []
    let downloadedCount = 0

    // Process each god that is ported or exclusive
    for (const god of gods) {
      if (god.status !== "ported" && god.status !== "exclusive") {
        updatedGods.push(god)
        continue
      }

      let godThumbnailUrl: string | null = null

      // Try to construct URL for full-size (256x256) thumbnail
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

      // Try to construct and test URLs for full-size images
      for (const nameVariation of godNameVariations) {
        // Try S2 pattern first
        const s2Url = `/images/T_${nameVariation}%28S2%29_Default_Icon.png`
        const noS2Url = `/images/T_${nameVariation}_Default_Icon.png`

        for (const testUrl of [s2Url, noS2Url]) {
          try {
            const testResponse = await axios.head(`https://wiki.smite2.com${testUrl}`, {
              timeout: 5000,
            })
            if (testResponse.status === 200) {
              godThumbnailUrl = testUrl
              console.log(`✅ Found full-size icon for ${god.name}: ${testUrl}`)
              break
            }
          } catch (_error) {
            // Icon doesn't exist, continue
          }
        }

        if (godThumbnailUrl) break
      }

      if (godThumbnailUrl) {
        console.log(`\\n🔍 Processing ${god.name}...`)

        const filename = `${god.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`
        const filepath = join(smite2ThumbnailsDir, filename)

        // Check if file already exists
        try {
          await readFile(filepath)
          console.log(`⏭️  Thumbnail already exists for ${god.name}`)
          updatedGods.push({
            ...god,
            smite2ThumbnailPath: `/images/thumbnails/smite2/thumb/${filename}`,
          })
          continue
        } catch (_error) {
          // File doesn't exist, download it
        }

        try {
          // Use the full-size 256x256 image URL directly
          const fullUrl = `https://wiki.smite2.com${godThumbnailUrl}`

          await downloadImage(fullUrl, filepath)
          downloadedCount++

          updatedGods.push({
            ...god,
            smite2ThumbnailPath: `/images/thumbnails/smite2/thumb/${filename}`,
          })

          // Small delay to be respectful
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (_error) {
          console.warn(`⚠️  Could not download thumbnail for ${god.name}`)
          updatedGods.push(god)
        }
      } else {
        console.log(`❌ No thumbnail found for ${god.name}`)
        updatedGods.push(god)
      }
    }

    // Update gods.json
    const jsonData = JSON.stringify(updatedGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    console.log("\\n✅ All Smite 2 thumbnails download complete!")
    console.log(`📊 Downloaded: ${downloadedCount} new thumbnails`)
    console.log(
      `🎯 Total with Smite 2 thumbnails: ${updatedGods.filter((god) => god.smite2ThumbnailPath).length}`
    )
  } catch (error) {
    console.error("❌ Error downloading all Smite 2 thumbnails:", error)
    throw error
  }
}

if (import.meta.main) {
  extractAllThumbnailsFromSmite2Wiki()
}
