"use client";

import { useReducer, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GlassCard, GlassButton } from "@/components/glass";
import { WizardProgress } from "./wizard-progress";
import { CustomerStep } from "./customer-step";
import { ItineraryStep } from "./itinerary-step";
import { ReviewStep } from "./review-step";
import {
  wizardReducer,
  makeInitialState,
  serializeDraftState,
  deserializeDraftState,
  WIZARD_STEPS,
  canAdvanceFromCustomers,
  canAdvanceFromItinerary,
  type WizardStep,
  type BookingPreFill,
} from "@/lib/booking/wizard-state";
import { useBookingDraftAutoSave } from "@/hooks/useBookingDraftAutoSave";
import { Spinner } from "@/components/common/spinner";

// ── Component ─────────────────────────────────────────────────────────────────

interface BookingWizardProps {
  bookingId?: string;
  /** 'overlay' renders compact layout inside GlassDialog; 'page' renders standalone page layout */
  mode?: "page" | "overlay";
  /** Called instead of router.push('/dashboard') when user cancels in overlay mode */
  onClose?: () => void;
  /** Called when booking is submitted in overlay mode */
  onComplete?: () => void;
  /** Pre-fill course entries for the first customer (Quick Book template) */
  initialCourses?: string[];
  /** Full pre-fill from drag-to-date (courses, dates, agency, resources) */
  initialPreFill?: BookingPreFill;
}

export function BookingWizard({
  bookingId: initialBookingId,
  mode = "page",
  onClose,
  onComplete,
  initialCourses,
  initialPreFill,
}: BookingWizardProps) {
  const router = useRouter();
  const isEditMode = !!initialBookingId;
  const isOverlay = mode === "overlay";

  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialState(initialBookingId ?? null),
  );

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [editResetError, setEditResetError] = useState<string | null>(null);

  const { isAuthenticated } = useConvexAuth();
  const creatingRef = useRef(false);
  const initializedRef = useRef(false);

  const createDraftShell = useMutation(
    api.bookingDraftMutations.createDraftShell,
  );
  const saveDraftState = useMutation(api.bookingDraftMutations.saveDraftState);
  const discardDraft = useMutation(api.bookingDraftMutations.discardDraft);
  const editBooking = useMutation(api.bookings.edit.editBooking);

  const { autoSaveError, cancelPending } = useBookingDraftAutoSave(
    state.bookingId,
    state,
  );

  const existingBooking = useQuery(
    api.bookingDraftMutations.getBookingForWizard,
    isEditMode && initialBookingId
      ? { bookingId: initialBookingId as Id<"bookings"> }
      : "skip",
  );

  const showEditConfirm =
    isEditMode &&
    !isResetting &&
    existingBooking != null &&
    (existingBooking.status === "Upcoming" ||
      existingBooking.status === "Completed");

  const isInitializing =
    !initError &&
    isEditMode &&
    (existingBooking === undefined || isResetting);

  // New booking with initialCourses: pre-fill locally (no draft shell yet)
  useEffect(() => {
    if (isEditMode || initializedRef.current || !initialCourses?.length) return;
    initializedRef.current = true;
    const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    dispatch({
      type: "RESET",
      payload: {
        bookingId: null,
        customers: [{
          id: makeId(),
          name: "",
          contact: {},
          flags: [],
          courseEntries: initialCourses.map((code) => ({
            id: makeId(),
            activityCode: code,
            dates: [],
            agency: "",
          })),
        }],
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, initialCourses]);

  // Drag-to-date: full pre-fill (courses + dates + agency + resources)
  useEffect(() => {
    if (isEditMode || initializedRef.current || !initialPreFill) return;
    initializedRef.current = true;
    const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    const { courses, startDate, endDate, agency, instructorSlug, venueSlug, boatSlug, equipmentSlug, compressorSlug } = initialPreFill;
    dispatch({
      type: "RESET",
      payload: {
        bookingId: null,
        startDate,
        endDate,
        agency,
        equipment: equipmentSlug,
        compressor: compressorSlug,
        preFillInstructorSlug: instructorSlug || undefined,
        preFillVenueSlug: venueSlug || undefined,
        preFillBoatSlug: boatSlug || undefined,
        customers: [{
          id: makeId(),
          name: "",
          contact: {},
          flags: [],
          courseEntries: courses.length > 0
            ? courses.map((code) => ({
                id: makeId(),
                activityCode: code,
                dates: [startDate, endDate],
                agency,
              }))
            : [{ id: makeId(), activityCode: "", dates: [startDate, endDate], agency }],
        }],
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, initialPreFill]);

  // Overlay mode: close overlay when booking is submitted
  useEffect(() => {
    if (isOverlay && state.submittedBookingId && onComplete) {
      onComplete();
    }
  }, [isOverlay, state.submittedBookingId, onComplete]);

  // Edit mode: redirect cancelled bookings + restore wizard state
  useEffect(() => {
    if (!isEditMode || existingBooking === undefined) return;
    if (existingBooking === null) return;

    if (existingBooking.status === "Cancelled") {
      router.push(`/booking/${initialBookingId}`);
      return;
    }

    if (
      existingBooking.status === "Upcoming" ||
      existingBooking.status === "Completed"
    )
      return;

    if (initializedRef.current) return;
    initializedRef.current = true;

    if (existingBooking.draftState) {
      const restored = deserializeDraftState(existingBooking.draftState);
      if (restored) {
        dispatch({ type: "RESET", payload: restored });
        return;
      }
    }

    dispatch({
      type: "RESET",
      payload: {
        step: "customers",
        bookingId: initialBookingId!,
      },
    });
  }, [isEditMode, existingBooking, initialBookingId, router]);

  async function handleConfirmEdit() {
    if (!initialBookingId) return;
    setEditResetError(null);
    setIsResetting(true);
    try {
      await editBooking({ bookingId: initialBookingId as Id<"bookings"> });
    } catch (err: unknown) {
      setEditResetError(
        err instanceof Error ? err.message : "Failed to reset booking",
      );
      setIsResetting(false);
    }
  }

  // ── Cancel / Discard ─────────────────────────────────────────────────────────

  async function handleCancel() {
    cancelPending();
    if (state.bookingId) {
      try {
        await discardDraft({ bookingId: state.bookingId as Id<"bookings"> });
      } catch {
        // Draft may already be gone — safe to ignore
      }
    }
    if (isOverlay && onClose) {
      onClose();
    } else {
      router.push("/dashboard");
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  const currentIndex = WIZARD_STEPS.indexOf(state.step);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1;

  // Validation gate for current step (review manages its own buttons)
  function canAdvance(): boolean {
    switch (state.step) {
      case "customers":
        return canAdvanceFromCustomers(state.customers);
      case "itinerary":
        return canAdvanceFromItinerary(state);
      default:
        return false;
    }
  }

  async function saveAndNavigate(targetStep: WizardStep) {
    setSaveError(null);
    cancelPending();
    setIsSaving(true);

    try {
      // Create draft shell on first save (deferred from mount)
      let currentBookingId = state.bookingId;
      if (!currentBookingId && !isEditMode && state.step === "itinerary" && targetStep === "review") {
        currentBookingId = await createDraftShell({
          startDate: state.startDate,
          endDate: state.endDate,
        });
        dispatch({ type: "SET_BOOKING_ID", payload: currentBookingId });
      }

      // When advancing to review with sameForAll, copy first customer courses to all
      if (
        state.step === "itinerary" &&
        targetStep === "review" &&
        state.sameForAll &&
        state.customers.length > 1
      ) {
        dispatch({ type: "COPY_COURSE_ENTRIES_TO_ALL" });
      }

      if (currentBookingId) {
        // Build snapshot with correct bookingId — dispatch hasn't committed yet
        const stateSnapshot = { ...state, bookingId: currentBookingId };
        await saveDraftState({
          bookingId: currentBookingId as Id<"bookings">,
          draftState: serializeDraftState(stateSnapshot),
        });
      }
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save progress",
      );
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    dispatch({ type: "SET_STEP", payload: targetStep });
  }

  function handleBack() {
    if (isFirstStep) return;
    void saveAndNavigate(WIZARD_STEPS[currentIndex - 1]);
  }

  function handleNext() {
    if (isLastStep) return;
    void saveAndNavigate(WIZARD_STEPS[currentIndex + 1]);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (initError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p
          style={{
            color: "var(--color-destructive)",
            fontFamily: "var(--font-body)",
          }}
        >
          {initError}
        </p>
      </div>
    );
  }

  if (showEditConfirm) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <GlassCard padding="lg">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-warning, #fbbf24)" }}
              />
              <div>
                <h2
                  className="text-lg font-semibold"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Edit this booking?
                </h2>
                <p
                  className="text-sm mt-1"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Editing will reset this booking to Draft and vacate all
                  resource reservations. All assigned resources will need to
                  re-confirm.
                </p>
              </div>
            </div>
            {editResetError && (
              <p
                className="text-sm"
                style={{ color: "var(--color-destructive)" }}
              >
                {editResetError}
              </p>
            )}
            <div className="flex gap-3">
              <GlassButton
                variant="primary"
                size="md"
                onClick={() => void handleConfirmEdit()}
              >
                Yes, edit booking
              </GlassButton>
              <GlassButton
                variant="secondary"
                size="md"
                onClick={() => router.back()}
              >
                Cancel
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div
        className="max-w-3xl mx-auto px-4 py-16 flex items-center justify-center"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <Spinner label="Preparing booking…" />
      </div>
    );
  }

  const bookingRef = initialBookingId
    ? `#${initialBookingId.slice(-8).toUpperCase()}`
    : state.bookingId
      ? `#${state.bookingId.slice(-8).toUpperCase()}`
      : null;

  // Step content
  function renderStepContent() {
    switch (state.step) {
      case "customers":
        return <CustomerStep customers={state.customers} dispatch={dispatch} />;
      case "itinerary":
        return <ItineraryStep state={state} dispatch={dispatch} />;
      case "review":
        return <ReviewStep state={state} dispatch={dispatch} isEditMode={isEditMode} />;
      default:
        return null;
    }
  }

  const advanceDisabled = !canAdvance();
  const isReviewStep = state.step === "review";

  // In overlay mode: compact layout filling the dialog's scrollable content area
  if (isOverlay) {
    return (
      <div className="px-4 py-4 sm:px-6">
        {bookingRef && (
          <p
            className="text-xs font-mono mb-3"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {bookingRef}
          </p>
        )}

        {/* Progress */}
        <WizardProgress currentStep={state.step} />

        {/* Step content */}
        <div className="mt-4">{renderStepContent()}</div>

        {/* Errors */}
        {saveError && (
          <p className="mt-3 text-sm" style={{ color: "var(--color-destructive)" }}>
            {saveError}
          </p>
        )}
        {autoSaveError && !saveError && !isReviewStep && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {autoSaveError}
          </p>
        )}

        {/* Navigation */}
        {!isReviewStep && (
          <div className="flex justify-between items-center mt-4 gap-4">
            <GlassButton
              variant="secondary"
              onClick={isFirstStep ? () => void handleCancel() : handleBack}
              disabled={isSaving}
              size="md"
            >
              <ChevronLeft size={16} />
              {isFirstStep ? "Cancel" : "Back"}
            </GlassButton>

            <GlassButton
              variant="primary"
              onClick={handleNext}
              disabled={advanceDisabled || isSaving}
              loading={isSaving}
              size="md"
            >
              Next
              <ChevronRight size={16} />
            </GlassButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-bold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-text-primary)",
            }}
          >
            {isEditMode && bookingRef
              ? `Editing: ${bookingRef}`
              : "New Booking"}
          </h1>
          <GlassButton
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => void handleCancel()}
            disabled={state.submitting}
            className="rounded-full"
            aria-label="Cancel booking"
          >
            <X size={16} />
          </GlassButton>
        </div>
        {bookingRef && (
          <p
            className="text-xs font-mono mt-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {bookingRef}
          </p>
        )}
      </div>

      {/* Progress */}
      <WizardProgress currentStep={state.step} />

      {/* Step content */}
      <div className="mt-6">{renderStepContent()}</div>

      {/* Errors (save-state errors — review step manages its own submit errors) */}
      {saveError && (
        <p
          className="mt-3 text-sm"
          style={{ color: "var(--color-destructive)" }}
        >
          {saveError}
        </p>
      )}
      {autoSaveError && !saveError && !isReviewStep && (
        <p
          className="mt-3 text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {autoSaveError}
        </p>
      )}

      {/* Navigation — review step renders its own back+submit buttons */}
      {!isReviewStep && (
        <div className="flex justify-between items-center mt-6 gap-4">
          <GlassButton
            variant="secondary"
            onClick={isFirstStep ? () => void handleCancel() : handleBack}
            disabled={isSaving}
            size="md"
          >
            <ChevronLeft size={16} />
            {isFirstStep ? "Cancel" : "Back"}
          </GlassButton>

          <GlassButton
            variant="primary"
            onClick={handleNext}
            disabled={advanceDisabled || isSaving}
            loading={isSaving}
            size="md"
          >
            Next
            <ChevronRight size={16} />
          </GlassButton>
        </div>
      )}
    </div>
  );
}
