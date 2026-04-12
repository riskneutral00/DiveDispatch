"use client";

import { useTranslations } from "next-intl";
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
  const tDialogs = useTranslations("booking.dialogs");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tDialogs("newBookingTitle")}
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
