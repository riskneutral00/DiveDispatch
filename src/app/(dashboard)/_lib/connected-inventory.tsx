'use client'

import { useMutation, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { api } from '@/lib/convex-generated'
import {
  EquipmentInventoryTable,
  type InventoryRow,
} from '@/components/inventory/equipment-inventory-table'
import type { Id } from '@/lib/convex-generated'
export function ConnectedEquipmentInventory() {
  const grouped = useQuery(api.equipmentInventory.listMyInventory)
  const addItemMutation = useMutation(api.equipmentInventory.addItem)
  const updateItemMutation = useMutation(api.equipmentInventory.updateItem)
  const removeItemMutation = useMutation(api.equipmentInventory.removeItem)

  const items: InventoryRow[] = grouped
    ? Object.values(grouped).flat()
    : []

  const handleAdd = useCallback(
    async (item: {
      gearType: string
      manufacturer?: string
      size?: string
      diopter?: number
      isPrescription?: boolean
      totalUnits: number
    }) => {
      await addItemMutation({
        gearType: item.gearType as 'wetsuit' | 'bcd' | 'fins' | 'mask' | 'regulator',
        ...(item.manufacturer !== undefined ? { manufacturer: item.manufacturer } : {}),
        ...(item.size !== undefined ? { size: item.size } : {}),
        ...(item.diopter !== undefined ? { diopter: item.diopter } : {}),
        ...(item.isPrescription !== undefined ? { isPrescription: item.isPrescription } : {}),
        totalUnits: item.totalUnits,
      })
    },
    [addItemMutation],
  )

  const handleUpdateUnits = useCallback(
    async (inventoryId: string, totalUnits: number) => {
      await updateItemMutation({
        inventoryId: inventoryId as Id<'equipmentInventory'>,
        totalUnits,
      })
    },
    [updateItemMutation],
  )

  const handleRemove = useCallback(
    async (inventoryId: string) => {
      await removeItemMutation({
        inventoryId: inventoryId as Id<'equipmentInventory'>,
      })
    },
    [removeItemMutation],
  )

  return (
    <EquipmentInventoryTable
      items={items}
      isLoading={grouped === undefined}
      onAddItem={handleAdd}
      onUpdateUnits={handleUpdateUnits}
      onRemoveItem={handleRemove}
    />
  )
}
