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
DashboardPageFrame (max-w-4xl)
  BookingCalendar (unified — same component all roles use)
    NavBar              ← / → week, month picker, "Today" jump
    WeekGrid            7 columns × 4 weeks, glass day cells
    Legend              one pill per vessel in the fleet (color-coded)
  BoatManifestWidget
    VesselSection × N   one per vessel (stacked)
      Header            vessel name + boatType badge + total pax for range
      DateGroup × N     per date with bookings
        GroupCard × N   per dive center (default) or per activity
          DiverTable    full passenger detail rows
```

---

## Unified Calendar (Fleet Mode)

The boat dashboard uses the **same `BookingCalendar`** component as every other role.
The glass pills, layout, navigation, and blocked-date behavior are identical.
What changes: the **legend** and **pill content**.

### Legend = Fleet Roster

Instead of booking statuses (Active, Draft, Upcoming, Completed), the legend shows
**one pill per vessel** in the operator's fleet. Each vessel gets a distinct color from
the vessel palette (8 colors, wraps). Toggling a legend pill hides/shows that vessel's
day pills — same UX as toggling status categories.

| Fleet size | Legend |
|-----------|-------|
| 1 vessel | 1 pill (e.g., "M.V. Hug Ocean") |
| 3 vessels | 3 pills, each a different color |
| 7 vessels | 7 pills (palette wraps at 8) |

### Day cells — vessel trip pills

Each day cell contains **one pill per vessel** (boats go out daily). The pill shows:

- **Label:** vessel name (e.g., "M.V. Hug Ocean")
- **Sub-label:** `{pax} pax · {route}` (e.g., "12 pax · Racha Noi")

Pill color = vessel's legend color. Same glass styling as booking pills.
If a vessel has no route for that day-of-week, the route portion is omitted.
If a vessel has 0 pax, the pill still appears (the boat is still going out).

### Blocked dates

Same guard as the booking calendar:
- Days with vessel trips are **locked** — cannot be blocked directly
- Operator must go into the vessel's day detail and cancel the trip first
- Once cancelled, the date becomes blockable via the same click-to-block flow

### Click behavior

Clicking a vessel pill fires `onBookingClick` with the trip ID, which opens
the `BookingQuickDetail` drawer (same as other roles).

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
