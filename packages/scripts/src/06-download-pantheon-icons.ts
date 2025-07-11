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

async function extractPantheonIconFromWiki(pantheonName: string): Promise<string | null> {
  try {
    // Try multiple sources for pantheon icons
    const sources = [
      // Main pantheon category pages
      `https://smite.fandom.com/wiki/Category:${pantheonName}_pantheon`,
      `https://smite.fandom.com/wiki/Category:${pantheonName}_Gods`,
      `https://smite.fandom.com/wiki/${pantheonName}_Pantheon`,
      `https://smite.fandom.com/wiki/${pantheonName}_pantheon`,
      // General pantheon page
      `https://smite.fandom.com/wiki/Pantheon`,
      // God class pages which often have pantheon icons
      `https://smite.fandom.com/wiki/List_of_gods`,
    ]

    for (const url of sources) {
      console.log(`  Checking: ${url}`)

      try {
        const response = await axios.get(url, { timeout: 10000 })
        const html = response.data

        // Look for pantheon icon patterns - Hi-Rez typically uses specific naming conventions
        const iconPatterns = [
          // Pantheon icon file naming patterns found in Smite
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*T_${pantheonName}[^"]*Icon[^"]*\\.(?:png|jpg|jpeg)[^"]*`,
            "i"
          ),
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*${pantheonName}[^"]*Pantheon[^"]*Icon[^"]*\\.(?:png|jpg|jpeg)[^"]*`,
            "i"
          ),
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*${pantheonName}[^"]*Symbol[^"]*\\.(?:png|jpg|jpeg)[^"]*`,
            "i"
          ),
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*${pantheonName}[^"]*Logo[^"]*\\.(?:png|jpg|jpeg)[^"]*`,
            "i"
          ),
          // Generic pantheon icon patterns
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*Pantheon[^"]*${pantheonName}[^"]*\\.(?:png|jpg|jpeg)[^"]*`,
            "i"
          ),
          new RegExp(
            `https://static\\.wikia\\.nocookie\\.net/smite_gamepedia/images/[^"]*${pantheonName}[^"]*\\.(?:png|jpg|jpeg)[^"]*`,
            "i"
          ),
        ]

        for (const pattern of iconPatterns) {
          const matches = html.match(pattern)
          if (matches) {
            // Filter out god portraits and other non-pantheon images
            const filteredMatches = matches.filter(
              (match: string) =>
                !match.includes("Default_Icon") && // God icons
                !match.includes("Card_") && // God cards
                !match.includes("Ability_") && // Ability icons
                !match.includes("Item_") && // Item icons
                (match.includes("Pantheon") ||
                  match.includes("Symbol") ||
                  match.includes("Logo") ||
                  match.includes("Icon"))
            )

            if (filteredMatches.length > 0) {
              console.log(`  Found pantheon icon: ${filteredMatches[0]}`)
              return filteredMatches[0]
            }
          }
        }

        // Look for pantheon icons in category pages or tables
        const categoryRegex = /<div[^>]*class="[^"]*category-page[^"]*"[^>]*>(.*?)<\/div>/s
        const categoryMatch = html.match(categoryRegex)

        if (categoryMatch) {
          const categoryHtml = categoryMatch[1]
          const imageRegex =
            /https:\/\/static\.wikia\.nocookie\.net\/smite_gamepedia\/images\/[^"]*\.(?:png|jpg|jpeg)[^"]*/g
          const imageMatches = categoryHtml.match(imageRegex)

          if (imageMatches && imageMatches.length > 0) {
            // Look for pantheon-specific icons
            const pantheonImages = imageMatches.filter(
              (url: string) =>
                url.toLowerCase().includes(pantheonName.toLowerCase()) &&
                (url.includes("Pantheon") ||
                  url.includes("Symbol") ||
                  url.includes("Logo") ||
                  url.includes("Icon"))
            )

            if (pantheonImages.length > 0) {
              console.log(`  Found category pantheon icon: ${pantheonImages[0]}`)
              return pantheonImages[0]
            }
          }
        }

        // Add small delay between requests to be respectful
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error: unknown) {
        console.log(`  Could not access ${url}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return null
  } catch (error) {
    console.error(`Error extracting pantheon icon for ${pantheonName}:`, error)
    return null
  }
}

async function downloadPantheonIcons(): Promise<void> {
  try {
    // Read gods data to get all unique pantheons
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    // Get unique pantheons
    const pantheons = [...new Set(gods.map((god) => god.pantheon))].sort()
    console.log(`Found ${pantheons.length} unique pantheons:`, pantheons)

    // Create pantheon icons directory in web package
    const pantheonIconsDir = join(process.cwd(), "..", "web", "public", "images", "pantheons")
    await mkdir(pantheonIconsDir, { recursive: true })

    console.log("🏛️  Downloading pantheon icons...")

    const pantheonData: Array<{ name: string; iconPath?: string }> = []

    for (const pantheon of pantheons) {
      console.log(`\n🔍 Processing ${pantheon} pantheon...`)

      let iconPath: string | undefined

      // Try to extract pantheon icon from wiki
      const iconUrl = await extractPantheonIconFromWiki(pantheon)

      if (iconUrl) {
        try {
          // Create filename from pantheon name
          const filename = `${pantheon.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`
          const filepath = join(pantheonIconsDir, filename)

          await downloadImage(iconUrl, filepath)
          iconPath = `/images/pantheons/${filename}`

          // Add a small delay to be respectful to the server
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (_error) {
          console.warn(`⚠️  Could not download icon for ${pantheon} pantheon`)
        }
      } else {
        console.warn(`⚠️  No icon found for ${pantheon} pantheon`)
      }

      pantheonData.push({
        name: pantheon,
        iconPath,
      })
    }

    // Save pantheon data to a separate file
    const pantheonDataPath = join(process.cwd(), "..", "data", "pantheons.json")
    const pantheonJsonData = JSON.stringify(pantheonData, null, 2)
    await writeFile(pantheonDataPath, pantheonJsonData, "utf8")

    console.log("\n✅ Pantheon icon download complete!")

    const downloadedCount = pantheonData.filter((p) => p.iconPath).length
    console.log(`📊 Downloaded ${downloadedCount}/${pantheons.length} pantheon icons`)

    if (downloadedCount > 0) {
      console.log("\n🏛️  Downloaded pantheon icons:")
      pantheonData
        .filter((p) => p.iconPath)
        .forEach((p) => console.log(`   - ${p.name}: ${p.iconPath}`))
    }

    if (downloadedCount < pantheons.length) {
      console.log("\n⚠️  Missing pantheon icons:")
      pantheonData.filter((p) => !p.iconPath).forEach((p) => console.log(`   - ${p.name}`))
    }
  } catch (error) {
    console.error("❌ Error downloading pantheon icons:", error)
    throw error
  }
}

if (import.meta.main) {
  downloadPantheonIcons()
}
