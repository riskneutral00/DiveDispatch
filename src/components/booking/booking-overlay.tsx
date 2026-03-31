"use client";

import { GlassDialog } from "@/components/ui";
import { BookingWizard } from "./booking-wizard";
import type { BookingPreFill } from "@/lib/booking/wizard-state";

interface BookingOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill course entries from Quick Book template (e.g. ['DSD'] or ['OW', 'AOW']) */
  initialCourses?: string[];
  /** Full pre-fill payload from drag-to-date (courses, dates, agency, resources) */
  initialPreFill?: BookingPreFill;
  /** Incremented by parent to force wizard remount for each new booking session */
  wizardKey?: number;
}

export function BookingOverlay({
  open,
  onClose,
  initialCourses,
  initialPreFill,
  wizardKey = 0,
}: BookingOverlayProps) {
  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title="New Booking"
      fullScreen
    >
      <BookingWizard
        key={wizardKey}
        mode="overlay"
        onClose={onClose}
        onComplete={onClose}
        initialCourses={initialCourses}
        initialPreFill={initialPreFill}
      />
    </GlassDialog>
  );
}
