import { readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { God } from "@arewesmite2yet/data/types"

async function cleanAllImages(): Promise<void> {
  try {
    console.log("🧹 Cleaning all images and thumbnails...")

    // Remove all image directories
    const imagesDirs = [
      join(process.cwd(), "..", "web", "public", "images", "thumbnails"),
      join(process.cwd(), "..", "web", "public", "images", "gods"),
      join(process.cwd(), "..", "web", "public", "images", "pantheons"),
    ]

    for (const dir of imagesDirs) {
      try {
        await rm(dir, { recursive: true, force: true })
        console.log(`✅ Removed directory: ${dir}`)
      } catch (_error) {
        console.log(`⚠️  Directory not found or already removed: ${dir}`)
      }
    }

    // Clean gods.json - remove all image-related fields
    const godsPath = join(process.cwd(), "..", "data", "gods.json")
    const godsDataRaw = await readFile(godsPath, "utf-8")
    const gods: God[] = JSON.parse(godsDataRaw)

    const cleanedGods = gods.map((god) => {
      const cleanedGod: any = { ...god }

      // Remove all image-related fields
      delete cleanedGod.imagePath
      delete cleanedGod.thumbnailPath
      delete cleanedGod.smite1ThumbnailPath
      delete cleanedGod.smite2ThumbnailPath

      return cleanedGod
    })

    // Write cleaned gods.json
    const jsonData = JSON.stringify(cleanedGods, null, 2)
    await writeFile(godsPath, jsonData, "utf8")

    console.log("✅ Cleaned gods.json - removed all image paths")
    console.log("🎉 All images and thumbnails removed successfully!")
    console.log("📝 gods.json cleaned of all image references")
  } catch (error) {
    console.error("❌ Error cleaning images:", error)
    throw error
  }
}

if (import.meta.main) {
  cleanAllImages()
}
