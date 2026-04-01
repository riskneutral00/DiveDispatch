# Equipment Inventory Page -- Design Override

> Route: `/{slug}/{roleSlug}/settings` (Equipment role only, below profile form)
> Overrides: MASTER.md
> Purpose: EM manages their gear catalog -- view, add, edit, delete inventory lines.

---

## Page Intent

Equipment managers need to see their entire stock at a glance, adjust quantities,
add new gear lines (any manufacturer, free-text), and remove discontinued items.
This is a working tool -- dense, scannable, efficient. No hand-holding.

Tone: functional spreadsheet energy in glass clothing.

---

## Layout

Embedded as a section within the existing Settings page for Equipment role,
below the profile form and above preferences.

```
DashboardPageFrame (max-w-3xl)
  ManageRolesConnected
  EquipmentProfileForm (existing)
  InventorySection (NEW)
    FormSectionHeader   "Inventory"  + [+ Add Item] button (secondary, sm)
    Filter bar          GlassSelect for gear type filter
    GlassCard
      Table             single table, all gear types, sortable columns
    Empty state         when no inventory rows exist
  PreferencesEditor (existing)
```

---

## Filter Bar

Single `GlassSelect` dropdown:
- Options: `All`, `Wetsuit`, `BCD`, `Fins`, `Mask`, `Regulator`
- Default: `All`
- Resets to `All` when items are added

---

## Table

Single table inside a `GlassCard` (`.glass-container`).

### Columns

| Column | Width | Content |
|--------|-------|---------|
| Gear Type | 100px fixed | Badge (text label, no color) |
| Manufacturer | flex | Free text, `--` if empty |
| Size | 80px | Text, `--` if empty |
| Rx | 60px | Diopter value or `--` |
| Units | 80px | Editable number input |
| Actions | 44px | Trash2 icon button (destructive-ghost, 44px touch) |

### Row behavior

- Rows are read-only by default. Units column is an inline `GlassInput` (type number, min 1).
- Changing units calls `updateItem` on blur or Enter.
- Manufacturer is displayed as text (editing manufacturer requires delete + re-add to keep it simple).

### Empty state

`EmptyState` component: "No inventory items yet. Add your first item to get started."

---

## Add Item Dialog

Triggered by the [+ Add Item] button. Uses `GlassDialog`.

### Fields

| Field | Type | Required |
|-------|------|----------|
| Gear Type | `GlassSelect` (5 canonical types) | Yes |
| Manufacturer | `GlassInput` (free text) | No |
| Size | `GlassInput` (free text) | No |
| Prescription | Checkbox | No |
| Diopter | `GlassInput` (number, shown when prescription checked) | Conditional |
| Total Units | `GlassInput` (number, min 1) | Yes |

### Submit

Primary button "Add Item". Calls `addItem`. On success, dialog closes, table refreshes
reactively via Convex subscription.

---

## Delete

Trash2 button per row. Confirmation via `GlassDialog`:
"Remove {manufacturer} {gearType} {size}? This cannot be undone."

If backend returns CONFLICT (active reservations), show inline error:
"Cannot remove -- active reservations exist for this item."

---

## Responsive

- Desktop: full table as described
- Mobile (<640px): table scrolls horizontally, filter bar full-width, dialog full-screen

---

## Accessibility

- Table uses semantic `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`
- Trash button: `aria-label="Remove {gearType} {size}"`
- Filter select: `aria-label="Filter by gear type"`
- Units input: `aria-label="Total units for {gearType} {size}"`
- Dialog focus trap via GlassDialog

---

## States

| State | Visual |
|-------|--------|
| `loading.initial` | Spinner inside GlassCard |
| `empty` | EmptyState component |
| `error.inline` | Red text below units input on save failure |
| `success.transient` | Brief green check on units input after save |
| `loading.action` | GlassButton loading state on Add/Delete |
