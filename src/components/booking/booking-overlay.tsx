"use client";

import { GlassDialog } from "@/components/glass";
import { BookingWizard } from "./booking-wizard";

interface BookingOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill course entries from Quick Book template (e.g. ['DSD'] or ['OW', 'AOW']) */
  initialCourses?: string[];
  /** Incremented by parent to force wizard remount for each new booking session */
  wizardKey?: number;
}

export function BookingOverlay({
  open,
  onClose,
  initialCourses,
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
      />
    </GlassDialog>
  );
}
