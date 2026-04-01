# Boat Operator Dashboard — Design Override

> Route: `/{slug}/boat` (Boat role dashboard)
> Overrides: MASTER.md
> Purpose: Boat operator sees vessel utilization at a glance and the full passenger manifest per vessel per day.

---

## Page Intent

Boat operators do not think in bookings. They think in vessels and seats.
"How full is M.V. Hug Ocean on Tuesday?" and "Who is on board?" are the two
questions this dashboard answers instantly.

Tone: harbour master's clipboard — dense, scannable, authoritative.

---

## Layout

```
DashboardPageFrame (max-w-5xl — wider than default to fit vessel grid)
  VesselCalendar
    NavBar              ← / → week, "Today" button, date range label
    VesselGrid          one row per vessel, 14 columns (days)
  BoatManifestWidget
    VesselSection × N   one per vessel (stacked)
      Header            vessel name + boatType badge + total pax for range
      DateGroup × N     per date with bookings
        GroupCard × N   per dive center (default) or per activity
          DiverTable    full passenger detail rows
```

---

## Vessel Calendar

### Grid structure

- 14 columns (2-week window), same date navigation as BookingCalendar
  (`useCalendarRange` hook, ← → week, "Today" jump)
- One row per vessel in the operator's fleet
- Row header (sticky left): vessel name + boatType badge (e.g. `day_boat`)
- `onRangeChange` fires when the visible window changes — drives the manifest below

### Day cells

Each cell shows a capacity pill: `{booked}/{total}` (e.g. `38/50`).

Color scale by utilization percentage:

| Utilization | Color | Token |
|-------------|-------|-------|
| 0% | `var(--color-text-secondary)` | Empty — muted |
| 1–49% | `var(--color-secondary)` | Blue — light load |
| 50–79% | `var(--color-accent)` | Amber — filling up |
| 80–99% | `var(--color-primary)` | Coral — near capacity |
| 100% | solid `var(--color-primary)` bg, white text | Full |

- Cell is a `<button>` — click selects it (highlight border `var(--color-accent)`)
- Selected cell state drives manifest filtering (future: scope manifest to that vessel + date)
- Today column gets a subtle top-border accent

### Empty vessel row

If a vessel has zero bookings for the entire 2-week window, show `0/{total}` in muted style
for each day. Do not hide the vessel — the operator needs to see all fleet members.

---

## Boat Manifest Widget

Below the vessel calendar. Shows full passenger details per vessel, driven by
the calendar's visible 2-week date range.

### Per-vessel section

Each vessel gets its own `GlassCard` section, stacked vertically.

- **Header row:** vessel name (heading), boatType badge, total pax summary for the range
- Vessels with zero bookings in the range: collapsed with "No bookings" message

### Filter controls

Single `GlassSimpleSelect` at the top of the widget:

| Option | Grouping |
|--------|----------|
| By Dive Center (default) | Groups under DC name headers |
| By Activity | Groups under activity type headers (OW, AOW, Fun Dive, etc.) |

### Date groups

Within each vessel section, bookings are grouped by date:

```
Date header: "Tuesday, 15 April 2026" + total pax for that date
  GroupCard (by DC or by activity, per filter)
    Header: DC name / activity label, instructor name, diver count
    DiverTable: expandable rows with full detail
```

### Diver detail table

Columns:

| Column | Width | Content |
|--------|-------|---------|
| Name | flex | `legalFirstName legalLastName` (preferred name in parens if different) |
| Nationality | 80px | Flag emoji + country code |
| Passport | 120px | Number + issuing country |
| Passport Exp | 100px | Date, red text if < 6 months from trip |
| Gender | 50px | M / F / Other |
| DOB | 100px | Date |
| Emergency | flex | Name + phone + relation |
| Cert | 80px | Agency + level if available |
| Medical | 60px | Flag icon if `medical_block`, allergy icon if `allergies` |

### Empty state

"No bookings for this period." — EmptyState component with Ship icon.

---

## Responsive

- Desktop (>1024px): full vessel grid + manifest side by side (grid scrolls horizontally if >4 vessels)
- Tablet (640–1024px): vessel grid scrolls horizontally, manifest full-width below
- Mobile (<640px): vessel grid compact (vessel name abbreviated, cells show number only),
  manifest diver table scrolls horizontally, date groups collapse to accordion

---

## Accessibility

- Vessel grid uses `role="grid"`, `role="row"`, `role="gridcell"`
- Each capacity cell: `aria-label="M.V. Hug Ocean, April 15, 38 of 50 seats booked"`
- Filter select: `aria-label="Group manifest by"`
- Diver table uses semantic `<table>`, `<th scope="col">`
- Expandable groups: `aria-expanded`, `aria-controls`
- Passport expiry warning: `role="alert"` on the cell

---

## States

| State | Visual |
|-------|--------|
| `loading.initial` | Skeleton grid (vessel rows × 14 date columns) |
| `loading.manifest` | Spinner inside each vessel section |
| `empty.calendar` | All cells show `0/N` in muted style |
| `empty.manifest` | EmptyState "No bookings for this period" |
| `error` | GlassCard with error message + retry button |
