"use client";

import { Dialog } from "@/components/ui";
import { BookingWizard } from "./booking-wizard";
import type { BookingPreFill } from "@/lib/booking/wizard-state";

interface BookingOverlayProps {
  open: boolean;
  onClose: () => void;
  initialCourses?: string[];
  initialPreFill?: BookingPreFill;
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
    <Dialog
      open={open}
      onClose={onClose}
      title="New Booking"
      fullScreen
      melt
    >
      <BookingWizard
        key={wizardKey}
        mode="overlay"
        onClose={onClose}
        onComplete={onClose}
        initialCourses={initialCourses}
        initialPreFill={initialPreFill}
      />
    </Dialog>
  );
}
