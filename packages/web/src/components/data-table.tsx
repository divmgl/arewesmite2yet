"use client"

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Sort data by default: ported/exclusive first (alphabetically), then not ported (alphabetically)
  const sortedData = [...data].sort((a: any, b: any) => {
    const statusA = a.status
    const statusB = b.status

    // Priority: ported/exclusive first, then not_ported
    const priorityA = statusA === "not_ported" ? 0 : 1
    const priorityB = statusB === "not_ported" ? 0 : 1

    if (priorityA !== priorityB) {
      return priorityB - priorityA // Higher priority first
    }

    // Within same priority, sort alphabetically by name
    return a.name.localeCompare(b.name)
  })

  const table = useReactTable({
    data: sortedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  // Get unique pantheons and classes for filter options
  const pantheons = Array.from(new Set(data.map((god: any) => god.pantheon))).sort()
  const classes = Array.from(new Set(data.map((god: any) => god.class))).sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 py-4">
        <Input
          placeholder="Filter gods..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={(table.getColumn("pantheon")?.getFilterValue() as string) ?? ""}
          onValueChange={(value) => {
            table.getColumn("pantheon")?.setFilterValue(value === "all" ? "" : value)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Pantheons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pantheons</SelectItem>
            {pantheons.map((pantheon) => (
              <SelectItem key={pantheon} value={pantheon}>
                {pantheon}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={(table.getColumn("class")?.getFilterValue() as string) ?? ""}
          onValueChange={(value) => {
            table.getColumn("class")?.setFilterValue(value === "all" ? "" : value)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls} value={cls}>
                {cls}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            table.getColumn("name")?.setFilterValue("")
            table.getColumn("pantheon")?.setFilterValue("")
            table.getColumn("class")?.setFilterValue("")
          }}
          className="ml-auto"
        >
          Clear Filters
        </Button>
      </div>
      <div className="rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="text-orange-400 font-normal font-serif text-base"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? "cursor-pointer select-none flex items-center gap-2"
                              : "",
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" && (
                            <ChevronUp className="h-4 w-4" />
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const god = row.original as any
                const isPortedOrExclusive = god.status === "ported" || god.status === "exclusive"

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={isPortedOrExclusive ? "bg-white/5" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
