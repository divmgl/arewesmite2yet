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

async function getSmite2ThumbnailUrl(godName: string): Promise<string | null> {
  try {
    // Clean god name for URL construction
    const cleanGodName = godName.replace(/[^a-zA-Z]/g, "")

    // Special name mappings for gods with different file naming on Smite 2 wiki
    const specialNames: Record<string, string> = {
      "Ah Muzen Cab": "AhMuzenCab",
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
    }

    const finalGodName = specialNames[godName] || cleanGodName

    // Construct the Smite 2 thumbnail URL using the discovered pattern
    // Format: /images/thumb/T_GodName%28S2%29_Default_Icon.png/35px-T_GodName%28S2%29_Default_Icon.png
    const thumbnailUrl = `/images/thumb/T_${finalGodName}%28S2%29_Default_Icon.png/35px-T_${finalGodName}%28S2%29_Default_Icon.png`

    // Test if this URL exists by making a HEAD request
    try {
      const testResponse = await axios.head(`https://wiki.smite2.com${thumbnailUrl}`, {
        timeout: 5000,
      })
      if (testResponse.status === 200) {
        console.log(`✅ Found Smite 2 thumbnail for ${godName}`)
        return `https://wiki.smite2.com${thumbnailUrl}`
      }
    } catch (_error) {
      console.log(`❌ No Smite 2 thumbnail found for ${godName}`)
      return null
    }

    return null
  } catch (error) {
    console.error(`Error getting Smite 2 thumbnail for ${godName}:`, error)
    return null
  }
}

async function downloadSmite2Thumbnails(): Promise<void> {
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

    console.log("🖼️  Downloading Smite 2 thumbnails...")
    console.log(`📊 Processing ${gods.length} gods...`)

    const updatedGods: God[] = []
    let downloadedCount = 0
    let skippedCount = 0

    for (const god of gods) {
      console.log(`\n🔍 Processing ${god.name}...`)

      // Only process gods that have Smite 2 wiki URLs (meaning they're ported or exclusive)
      if (!god.smite2Wiki) {
        console.log(`⏭️  ${god.name} not in Smite 2, skipping`)
        updatedGods.push(god)
        skippedCount++
        continue
      }

      const filename = `${god.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`
      const filepath = join(smite2ThumbnailsDir, filename)

      // Check if file already exists to avoid re-downloading
      try {
        await readFile(filepath)
        console.log(`⏭️  Smite 2 thumbnail already exists for ${god.name}`)
        updatedGods.push({
          ...god,
          smite2ThumbnailPath: `/images/thumbnails/smite2/${filename}`,
        })
        continue
      } catch (_error) {
        // File doesn't exist, download it
      }

      // Get the thumbnail URL
      const thumbnailUrl = await getSmite2ThumbnailUrl(god.name)

      if (thumbnailUrl) {
        try {
          await downloadImage(thumbnailUrl, filepath)
          downloadedCount++

          // Add thumbnail path to god data
          updatedGods.push({
            ...god,
            smite2ThumbnailPath: `/images/thumbnails/smite2/${filename}`,
          })

          // Add a small delay to be respectful to the server
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (_error) {
          console.warn(`⚠️  Could not download Smite 2 thumbnail for ${god.name}`)
          updatedGods.push(god)
        }
      } else {
        console.log(`❌ No thumbnail URL found for ${god.name}`)
        updatedGods.push(god)
      }
    }

    // Update gods.json with thumbnail paths
    const jsonData = JSON.stringify(updatedGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    console.log("\n✅ Smite 2 thumbnail download complete!")
    console.log(`📊 Results:`)
    console.log(`   Downloaded: ${downloadedCount} new thumbnails`)
    console.log(`   Skipped (not in Smite 2): ${skippedCount}`)
    console.log(
      `   Total with Smite 2 thumbnails: ${updatedGods.filter((god) => god.smite2ThumbnailPath).length}`
    )
  } catch (error) {
    console.error("❌ Error downloading Smite 2 thumbnails:", error)
    throw error
  }
}

if (import.meta.main) {
  downloadSmite2Thumbnails()
}
