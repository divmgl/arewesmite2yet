import type { God } from "@arewesmite2yet/data/types"
import { Card } from "@/components/ui/card"

interface StatsCardsProps {
  gods: God[]
}

export function StatsCards({ gods }: StatsCardsProps) {
  const totalGods = gods.length
  const portedGods = gods.filter((god) => god.status === "ported").length
  const exclusiveGods = gods.filter((god) => god.status === "exclusive").length
  const notPortedGods = gods.filter((god) => god.status === "not_ported").length
  
  // Calculate percentages based on gods that can be ported (exclude exclusives)
  const portableGods = totalGods - exclusiveGods
  const portedPercentage = Math.round((portedGods / portableGods) * 100)
  const notPortedPercentage = Math.round((notPortedGods / portableGods) * 100)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Card className="p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Total Gods</p>
          <div className="text-2xl font-bold">{totalGods}</div>
          <p className="text-xs text-muted-foreground">In Smite 1</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Ported</p>
          <div className="text-2xl font-bold text-green-400">{portedGods}</div>
          <p className="text-xs text-muted-foreground">{portedPercentage}% complete</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Not Ported</p>
          <div className="text-2xl font-bold text-red-400">{notPortedGods}</div>
          <p className="text-xs text-muted-foreground">{notPortedPercentage}% remaining</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Exclusive</p>
          <div className="text-2xl font-bold text-purple-400">{exclusiveGods}</div>
          <p className="text-xs text-muted-foreground">Smite 2 only</p>
        </div>
      </Card>
    </div>
  )
}
