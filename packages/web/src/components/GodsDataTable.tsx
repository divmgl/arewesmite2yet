import type { God } from "@arewesmite2yet/data/types"
import { columns } from "./columns"
import { DataTable } from "./data-table"

interface GodsDataTableProps {
  data: God[]
}

export function GodsDataTable({ data }: GodsDataTableProps) {
  return <DataTable columns={columns} data={data} />
}
