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
    })

    await pipeline(response.data, createWriteStream(filepath))
    console.log(`✅ Downloaded: ${filepath}`)
  } catch (error) {
    console.error(`❌ Failed to download ${url}:`, error)
    throw error
  }
}

async function extractImageFromWiki(wikiUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(wikiUrl)
    const html = response.data

    if (wikiUrl.includes("wiki.smite2.com")) {
      // Smite 2 wiki strategy: Find god portrait in infobox
      const infoboxRegex = /<table[^>]*class="[^"]*infobox[^"]*"[^>]*>(.*?)<\/table>/s
      const infoboxMatch = html.match(infoboxRegex)

      if (infoboxMatch) {
        const infoboxHtml = infoboxMatch[1]
        // Look for the first image in the infobox - this is typically the god portrait
        const imageRegex = /<img[^>]*src="([^"]*)"[^>]*>/
        const imageMatch = infoboxHtml.match(imageRegex)

        if (imageMatch) {
          let imageUrl = imageMatch[1]

          // Handle relative URLs
          if (imageUrl.startsWith("/")) {
            imageUrl = `https://wiki.smite2.com${imageUrl}`
          }

          return imageUrl
        }
      }
    } else if (wikiUrl.includes("smite.fandom.com")) {
      // Smite 1 wiki strategy: Look for static.wikia.nocookie.net URLs
      const staticImageRegex =
        /https:\/\/static\.wikia\.nocookie\.net\/smite_gamepedia\/images\/[^"]*\.(?:png|jpg|jpeg|webp)[^"]*(?=")/gi
      const staticMatches = html.match(staticImageRegex)

      if (staticMatches && staticMatches.length > 0) {
        // Find the god portrait - typically the largest image or one with the god name
        for (const imageUrl of staticMatches) {
          // Skip small icons and ability icons
          if (
            !imageUrl.includes("Icons_") &&
            !imageUrl.includes("_Icon") &&
            (imageUrl.includes("Card_") ||
              imageUrl.includes("Default") ||
              imageUrl.match(/\d{3}x\d{3}/) ||
              imageUrl.includes("250px"))
          ) {
            return imageUrl
          }
        }

        // If no perfect match, use the first non-icon image
        for (const imageUrl of staticMatches) {
          if (!imageUrl.includes("Icons_") && !imageUrl.includes("_Icon")) {
            return imageUrl
          }
        }

        // Last resort - use any image
        return staticMatches[0]
      }
    }

    return null
  } catch (error) {
    console.error(`Error extracting image from ${wikiUrl}:`, error)
    return null
  }
}

async function downloadGodImages(): Promise<void> {
  try {
    // Read gods data
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Create images directory in web package
    const imagesDir = join(process.cwd(), "..", "web", "public", "images", "gods")
    await mkdir(imagesDir, { recursive: true })

    console.log("🖼️  Downloading god images...")

    const updatedGods: God[] = []

    for (const god of gods) {
      console.log(`\n🔍 Processing ${god.name}...`)

      let imageUrl: string | null = null

      // Try Smite 2 wiki first if available
      if (god.smite2Wiki) {
        imageUrl = await extractImageFromWiki(god.smite2Wiki)
      }

      // Fall back to Smite 1 wiki if no Smite 2 image
      if (!imageUrl && god.smite1Wiki) {
        imageUrl = await extractImageFromWiki(god.smite1Wiki)
      }

      let imagePath: string | undefined

      if (imageUrl) {
        try {
          // Create filename from god name
          const filename = `${god.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.jpg`
          const filepath = join(imagesDir, filename)

          await downloadImage(imageUrl, filepath)
          imagePath = `/images/gods/${filename}`

          // Add a small delay to be respectful to the server
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (_error) {
          console.warn(`⚠️  Could not download image for ${god.name}`)
        }
      } else {
        console.warn(`⚠️  No image found for ${god.name}`)
      }

      // Add image path to god data
      updatedGods.push({
        ...god,
        imagePath,
      })
    }

    // Update gods.json with image paths
    const jsonData = JSON.stringify(updatedGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    console.log("\n✅ Image download complete!")

    const downloadedCount = updatedGods.filter((god) => god.imagePath).length
    console.log(`📊 Downloaded ${downloadedCount}/${gods.length} god images`)
  } catch (error) {
    console.error("❌ Error downloading images:", error)
    throw error
  }
}

if (import.meta.main) {
  downloadGodImages()
}
