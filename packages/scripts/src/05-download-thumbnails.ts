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

async function extractThumbnailFromWiki(wikiUrl: string, godName: string): Promise<string | null> {
  try {
    const response = await axios.get(wikiUrl, { timeout: 10000 })
    const html = response.data

    if (wikiUrl.includes("wiki.smite2.com")) {
      // Clean god name for matching
      const cleanGodName = godName.replace(/[^a-zA-Z]/g, "")

      // Try to construct the god-specific icon URL directly
      // Format: T_GodName%28S2%29_Default_Icon.png/35px-T_GodName%28S2%29_Default_Icon.png
      const constructedIconUrl = `/images/thumb/T_${cleanGodName}%28S2%29_Default_Icon.png/35px-T_${cleanGodName}%28S2%29_Default_Icon.png`

      // Test if this URL exists by making a HEAD request
      try {
        const testResponse = await axios.head(`https://wiki.smite2.com${constructedIconUrl}`, {
          timeout: 5000,
        })
        if (testResponse.status === 200) {
          console.log(`✅ Found constructed icon for ${godName}`)
          return `https://wiki.smite2.com${constructedIconUrl}`
        }
      } catch (_error) {
        // Icon doesn't exist, continue with fallback methods
      }

      // Look for god-specific 35px icon: T_GodName%28S2%29_Default_Icon.png/35px-
      // %28 = ( and %29 = ) in URL encoding
      const specificIconRegex = new RegExp(
        `/images/thumb/T_${cleanGodName}%28S2%29_Default_Icon\\.png/35px-T_${cleanGodName}%28S2%29_Default_Icon\\.png[^"]*`,
        "i"
      )
      const specificMatch = html.match(specificIconRegex)

      if (specificMatch) {
        return `https://wiki.smite2.com${specificMatch[0]}`
      }

      // Look for the actual format found: T_GodNameS2_Default.png but try to get a smaller version
      const actualFormatRegex = new RegExp(
        `/images/thumb/T_${cleanGodName}S2_Default\\.png/[^"]*`,
        "i"
      )
      const actualMatch = html.match(actualFormatRegex)

      if (actualMatch) {
        // Try to get a smaller version by modifying the URL
        const baseUrl = actualMatch[0]
        const smallerUrl = baseUrl.replace(/\/\d+px-/, "/35px-")
        return `https://wiki.smite2.com${smallerUrl}`
      }

      // Fallback: look for any god icon with the god name
      const fallbackRegex = new RegExp(
        `/images/thumb/T_[^/]*${cleanGodName}[^/]*_Default_Icon\\.png/35px-T_[^/]*${cleanGodName}[^/]*_Default_Icon\\.png[^"]*`,
        "i"
      )
      const fallbackMatch = html.match(fallbackRegex)

      if (fallbackMatch) {
        return `https://wiki.smite2.com${fallbackMatch[0]}`
      }
    } else if (wikiUrl.includes("smite.fandom.com")) {
      // Look for god icon patterns: prioritize T_GodName_Default_Icon.png (transparent icons)
      const cleanGodName = godName.replace(/[^a-zA-Z]/g, "")

      // Build potential god name variations for matching
      const nameVariations = [
        cleanGodName,
        godName.replace(/[^a-zA-Z0-9]/g, ""), // Keep numbers like Ne Zha
        godName.replace(/\s+/g, ""), // Remove spaces
        godName.replace(/['\s]/g, ""), // Remove apostrophes and spaces
      ]

      // Special name mappings for gods with different file naming
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

      if (specialNames[godName]) {
        nameVariations.unshift(specialNames[godName])
      }

      // Try to find small thumbnail images, prioritizing Icon over Card
      const thumbnailPatterns = []

      // First priority: Look for T_GodName_Default_Icon.png (transparent icons)
      for (const nameVar of nameVariations) {
        thumbnailPatterns.push(
          // Already scaled icon
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*T_${nameVar}_Default_Icon\\.png/revision/latest/(smart/width/3[0-9]|scale-to-width-down/3[0-9])[^"]*`,
            "i"
          ),
          // Full-size icon we can scale
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*T_${nameVar}_Default_Icon\\.png/revision/latest[^"]*`,
            "i"
          )
        )
      }

      // Second priority: Look for abbreviated names like T_AMC_Default_Icon.png
      thumbnailPatterns.push(
        /https:\/\/static\.wikia\.nocookie\.net\/smite_gamepedia\/images\/[^"]*T_[A-Z]{2,4}_Default_Icon\.png\/revision\/latest\/(smart\/width\/3[0-9]|scale-to-width-down\/3[0-9])[^"]*/i,
        /https:\/\/static\.wikia\.nocookie\.net\/smite_gamepedia\/images\/[^"]*T_[A-Z]{2,4}_Default_Icon\.png\/revision\/latest[^"]*/i
      )

      // Third priority: Look for any Icon pattern that might match
      thumbnailPatterns.push(
        /https:\/\/static\.wikia\.nocookie\.net\/smite_gamepedia\/images\/[^"]*T_[^"]*_Default_Icon\.png\/revision\/latest\/(smart\/width\/3[0-9]|scale-to-width-down\/3[0-9])[^"]*/i,
        /https:\/\/static\.wikia\.nocookie\.net\/smite_gamepedia\/images\/[^"]*T_[^"]*_Default_Icon\.png\/revision\/latest[^"]*/i
      )

      // Fourth priority: Fallback to Card images if Icons don't exist
      for (const nameVar of nameVariations) {
        thumbnailPatterns.push(
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*T_${nameVar}_Default_Card\\.png/revision/latest/(smart/width/3[0-9]|scale-to-width-down/3[0-9])[^"]*`,
            "i"
          ),
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*T_${nameVar}_Default_Card\\.png/revision/latest[^"]*`,
            "i"
          )
        )
      }

      for (const pattern of thumbnailPatterns) {
        const match = html.match(pattern)
        if (match) {
          const url = match[0]

          // If this is a full-size image, try to make it a small thumbnail
          if (!url.includes("smart/width/") && !url.includes("scale-to-width-down/")) {
            // Try to create a scaled version
            const baseUrl = url.split("/revision/latest")[0]
            const scaledUrl = `${baseUrl}/revision/latest/scale-to-width-down/36`

            // Test if the scaled version exists
            try {
              const testResponse = await axios.head(scaledUrl, { timeout: 5000 })
              if (testResponse.status === 200) {
                return scaledUrl
              }
            } catch (_error) {
              // Try smart scaling instead
              const altScaledUrl = `${baseUrl}/revision/latest/smart/width/36/height/36`
              try {
                const testResponse2 = await axios.head(altScaledUrl, { timeout: 5000 })
                if (testResponse2.status === 200) {
                  return altScaledUrl
                }
              } catch (_error2) {
                // Use original as last resort
              }
            }
          }

          return url
        }
      }
    }

    return null
  } catch (error) {
    console.error(`Error extracting thumbnail from ${wikiUrl}:`, error)
    return null
  }
}

async function downloadGodThumbnails(): Promise<void> {
  try {
    // Read gods data
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Create separate directories for Smite 1 and Smite 2 thumbnails
    const smite1ThumbnailsDir = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "images",
      "thumbnails",
      "smite1"
    )
    const smite2ThumbnailsDir = join(
      process.cwd(),
      "..",
      "web",
      "public",
      "images",
      "thumbnails",
      "smite2"
    )
    await mkdir(smite1ThumbnailsDir, { recursive: true })
    await mkdir(smite2ThumbnailsDir, { recursive: true })

    console.log("🖼️  Downloading god thumbnails...")

    const updatedGods: God[] = []

    for (const god of gods) {
      console.log(`\n🔍 Processing ${god.name}...`)

      let smite1ThumbnailPath: string | undefined
      let smite2ThumbnailPath: string | undefined

      // Download Smite 1 thumbnail if available (ONLY if not already exists)
      if (god.smite1Wiki) {
        const filename = `${god.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`
        const filepath = join(smite1ThumbnailsDir, filename)

        // Check if file already exists to avoid re-downloading
        try {
          await readFile(filepath)
          console.log(`⏭️  Smite 1 thumbnail already exists for ${god.name}`)
          smite1ThumbnailPath = `/images/thumbnails/smite1/${filename}`
        } catch (_error) {
          // File doesn't exist, download it
          const smite1ThumbnailUrl = await extractThumbnailFromWiki(god.smite1Wiki, god.name)
          if (smite1ThumbnailUrl) {
            try {
              await downloadImage(smite1ThumbnailUrl, filepath)
              smite1ThumbnailPath = `/images/thumbnails/smite1/${filename}`

              // Add a small delay to be respectful to the server
              await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (_error) {
              console.warn(`⚠️  Could not download Smite 1 thumbnail for ${god.name}`)
            }
          }
        }
      }

      // Download Smite 2 thumbnail if available (ONLY if not already exists)
      if (god.smite2Wiki) {
        const filename = `${god.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`
        const filepath = join(smite2ThumbnailsDir, filename)

        // Check if file already exists to avoid re-downloading
        try {
          await readFile(filepath)
          console.log(`⏭️  Smite 2 thumbnail already exists for ${god.name}`)
          smite2ThumbnailPath = `/images/thumbnails/smite2/${filename}`
        } catch (_error) {
          // File doesn't exist, download it
          const smite2ThumbnailUrl = await extractThumbnailFromWiki(god.smite2Wiki, god.name)
          if (smite2ThumbnailUrl) {
            try {
              await downloadImage(smite2ThumbnailUrl, filepath)
              smite2ThumbnailPath = `/images/thumbnails/smite2/${filename}`

              // Add a small delay to be respectful to the server
              await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (_error) {
              console.warn(`⚠️  Could not download Smite 2 thumbnail for ${god.name}`)
            }
          }
        }
      }

      // Keep legacy thumbnailPath for backward compatibility (prefer Smite 2, fallback to Smite 1)
      const thumbnailPath = smite2ThumbnailPath || smite1ThumbnailPath

      // Add thumbnail paths to god data
      updatedGods.push({
        ...god,
        thumbnailPath,
        smite1ThumbnailPath,
        smite2ThumbnailPath,
      })
    }

    // Update gods.json with thumbnail paths
    const jsonData = JSON.stringify(updatedGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    console.log("\n✅ Thumbnail download complete!")

    const smite1Count = updatedGods.filter((god) => god.smite1ThumbnailPath).length
    const smite2Count = updatedGods.filter((god) => god.smite2ThumbnailPath).length
    const totalCount = updatedGods.filter((god) => god.thumbnailPath).length

    console.log(`📊 Downloaded thumbnails:`)
    console.log(`   Smite 1: ${smite1Count}/${gods.length}`)
    console.log(`   Smite 2: ${smite2Count}/${gods.length}`)
    console.log(`   Total: ${totalCount}/${gods.length} gods have at least one thumbnail`)
  } catch (error) {
    console.error("❌ Error downloading thumbnails:", error)
    throw error
  }
}

if (import.meta.main) {
  downloadGodThumbnails()
}
