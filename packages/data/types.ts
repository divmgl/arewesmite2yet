export interface God {
  id: number
  name: string
  pantheon: string
  class: string
  status: "ported" | "not_ported" | "exclusive"
  releaseDate: string | null
  smite1Wiki?: string
  smite2Wiki?: string
  portedDate?: string
  imagePath?: string
  thumbnailPath?: string
  smite1ThumbnailPath?: string
  smite2ThumbnailPath?: string
  smite1CardPath?: string
}

export type GodStatus = "ported" | "not_ported" | "exclusive"

export interface GodDetails {
  pantheon: string
  class: string
  portedDate: string
}
