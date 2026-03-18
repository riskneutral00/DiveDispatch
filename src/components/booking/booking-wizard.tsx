"use client";

import { useReducer, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GlassCard, GlassButton } from "@/components/glass";
import { WizardProgress } from "./wizard-progress";
import { CustomerStep } from "./customer-step";
import { ItineraryStep } from "./itinerary-step";
import { ResourceStep } from "./resource-step";
import { BookingConfirmView } from "./booking-confirm-view";
import {
  wizardReducer,
  makeInitialState,
  serializeDraftState,
  deserializeDraftState,
  WIZARD_STEPS,
  canAdvanceFromCustomers,
  canAdvanceFromItinerary,
  canAdvanceFromResources,
  deriveActivityType,
  type WizardStep,
} from "@/lib/booking/wizard-state";
import { useBookingDraftAutoSave } from "@/hooks/useBookingDraftAutoSave";

// ── Component ─────────────────────────────────────────────────────────────────

interface BookingWizardProps {
  bookingId?: string;
}

export function BookingWizard({
  bookingId: initialBookingId,
}: BookingWizardProps) {
  const router = useRouter();
  const isEditMode = !!initialBookingId;

  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialState(initialBookingId ?? null),
  );

  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
  const submitToDraft = useMutation(api.bookings.create.submitToDraft);

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
    (isEditMode
      ? existingBooking === undefined || isResetting
      : state.bookingId === null);

  // New booking: create draft shell once on mount
  useEffect(() => {
    if (isEditMode || creatingRef.current || state.bookingId || !isAuthenticated) return;
    creatingRef.current = true;

    createDraftShell()
      .then((id) => dispatch({ type: "SET_BOOKING_ID", payload: id }))
      .catch((err: unknown) => {
        creatingRef.current = false;
        setInitError(
          err instanceof Error ? err.message : "Failed to start booking",
        );
      });
  }, [isEditMode, state.bookingId, createDraftShell, isAuthenticated]);

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
    router.push("/dashboard");
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  const currentIndex = WIZARD_STEPS.indexOf(state.step);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1;

  // Validation gate for current step
  function canAdvance(): boolean {
    switch (state.step) {
      case "customers":
        return canAdvanceFromCustomers(state.customers);
      case "itinerary":
        return canAdvanceFromItinerary(state);
      case "resources":
        return canAdvanceFromResources(state);
      default:
        return false;
    }
  }

  async function saveAndNavigate(targetStep: WizardStep) {
    setSaveError(null);
    cancelPending();

    if (state.bookingId) {
      setIsSaving(true);
      try {
        // When advancing to resources with sameForAll, copy first customer courses to all
        if (
          state.step === "itinerary" &&
          targetStep === "resources" &&
          state.sameForAll &&
          state.customers.length > 1
        ) {
          dispatch({ type: "COPY_COURSE_ENTRIES_TO_ALL" });
        }

        await saveDraftState({
          bookingId: state.bookingId as Id<"bookings">,
          draftState: serializeDraftState(state),
        });
      } catch (err: unknown) {
        setSaveError(
          err instanceof Error ? err.message : "Failed to save progress",
        );
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

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

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!state.bookingId) return;
    setSubmitError(null);
    dispatch({ type: "SET_SUBMITTING", value: true });

    try {
      const { customers, days } = state;
      const activityType = deriveActivityType(customers);

      const sessions = days
        .filter(
          (d) =>
            d.venueType !== "shore" &&
            (d.inventoryUnitId ||
              d.externalVenueName ||
              d.poolInventoryUnitId ||
              d.externalPoolName),
        )
        .map((d) => ({
          inventoryUnitId: (d.inventoryUnitId ||
            d.poolInventoryUnitId ||
            "") as Id<"inventoryUnits">,
          date: d.date,
          startTime: d.startTime,
          endTime: d.endTime,
          timezone: d.timezone,
          unitsRequested: Math.max(customers.length, 1),
          deliveryLocation: (d.venueType === "pool" ? "Pool" : "BoatPier") as
            | "BoatPier"
            | "Pool"
            | "Beach",
        }));

      const divers = customers.map((c) => {
        const firstEntry = c.courseEntries?.[0];
        const allCodes = [
          ...new Set(
            (c.courseEntries ?? []).map((e) => e.activityCode).filter(Boolean),
          ),
        ];
        const primaryFlag = c.flags?.[0] ?? { code: "GB", label: "English" };
        return {
          name: c.name,
          abbrev: c.name.charAt(0).toUpperCase(),
          flag: { code: primaryFlag.code, label: primaryFlag.label },
          startDate: firstEntry?.dates[0] ?? state.startDate,
          endDate:
            firstEntry?.dates[1] ?? firstEntry?.dates[0] ?? state.endDate,
          agency: firstEntry?.agency ?? "",
          activityType:
            allCodes as import("@/lib/constants/course-catalog").CourseCode[],
        };
      });

      const externalStakeholders: Record<string, string | undefined> = {};
      if (state.equipmentIsExternal && state.externalEquipmentName) {
        externalStakeholders.equipmentManagerName = state.externalEquipmentName;
      }
      if (state.compressorIsExternal && state.externalCompressorName) {
        externalStakeholders.compressorName = state.externalCompressorName;
      }

      await submitToDraft({
        bookingId: state.bookingId as Id<"bookings">,
        sessions,
        bookingData: {
          activityType,
          startDate: state.startDate,
          endDate: state.endDate,
          portalContact: true,
          portalMedical: true,
          portalWaiver: false,
          equipmentManagerId:
            !state.equipmentIsExternal && state.equipment
              ? (state.equipment as Id<"inventoryUnits">)
              : undefined,
          compressorId:
            !state.compressorIsExternal && state.compressor
              ? (state.compressor as Id<"inventoryUnits">)
              : undefined,
          ...(Object.keys(externalStakeholders).length > 0
            ? { externalStakeholders }
            : {}),
          divers,
        },
      });

      dispatch({ type: "SET_SUBMITTED_BOOKING_ID", id: state.bookingId });
      dispatch({ type: "SET_STEP", payload: "confirm" });
    } catch (err) {
      dispatch({ type: "SET_SUBMITTING", value: false });
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; reason?: string };
        setSubmitError(
          data.reason ?? data.code ?? "Submission failed. Please try again.",
        );
      } else {
        setSubmitError("An unexpected error occurred. Please try again.");
      }
    }
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
        <GlassCard padding="lg" elevated>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-warning, #f59e0b)" }}
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
        <span
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-3"
          aria-hidden
        />
        <span style={{ fontFamily: "var(--font-body)" }}>
          Preparing booking…
        </span>
      </div>
    );
  }

  const bookingRef = initialBookingId
    ? `#${initialBookingId.slice(-8).toUpperCase()}`
    : state.bookingId
      ? `#${state.bookingId.slice(-8).toUpperCase()}`
      : null;

  // Confirmation view (Step 4) — full-page, no navigation chrome
  if (state.step === "confirm") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold mb-1"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-text-primary)",
            }}
          >
            {isEditMode ? "Booking Updated" : "Booking Created"}
          </h1>
          {bookingRef && (
            <p
              className="text-xs font-mono"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {bookingRef}
            </p>
          )}
        </div>
        <WizardProgress currentStep={state.step} />
        <div className="mt-6">
          <BookingConfirmView state={state} />
        </div>
      </div>
    );
  }

  // Step content
  function renderStepContent() {
    switch (state.step) {
      case "customers":
        return <CustomerStep customers={state.customers} dispatch={dispatch} />;
      case "itinerary":
        return <ItineraryStep state={state} dispatch={dispatch} />;
      case "resources":
        return <ResourceStep state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  }

  const advanceDisabled = !canAdvance();
  const isResourceStep = state.step === "resources";

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
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={state.submitting}
            className="p-2 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: "var(--color-glass-bg)",
              border: "1px solid var(--color-glass-border)",
              color: "var(--color-text-secondary)",
            }}
            title="Cancel and return to dashboard"
            aria-label="Cancel booking"
          >
            <X size={18} />
          </button>
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

      {/* Errors */}
      {saveError && (
        <p
          className="mt-3 text-sm"
          style={{ color: "var(--color-destructive)" }}
        >
          {saveError}
        </p>
      )}
      {submitError && (
        <div
          className="flex items-start gap-3 mt-3 p-3 rounded-[var(--border-radius)] text-sm"
          role="alert"
          style={{
            background:
              "color-mix(in srgb, var(--color-destructive) 10%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--color-destructive) 30%, transparent)",
            color: "var(--color-destructive)",
          }}
        >
          <AlertTriangle
            size={15}
            className="flex-shrink-0 mt-0.5"
            aria-hidden
          />
          <span>{submitError}</span>
        </div>
      )}
      {autoSaveError && !saveError && (
        <p
          className="mt-3 text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {autoSaveError}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6 gap-4">
        <GlassButton
          variant="secondary"
          onClick={isFirstStep ? () => void handleCancel() : handleBack}
          disabled={isSaving || state.submitting}
          size="md"
        >
          <ChevronLeft size={16} />
          {isFirstStep ? "Cancel" : "Back"}
        </GlassButton>

        {isResourceStep ? (
          <GlassButton
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={advanceDisabled || state.submitting || !state.bookingId}
            loading={state.submitting}
            size="md"
          >
            <Send size={16} />
            {isEditMode ? "Update Booking" : "Submit Booking"}
          </GlassButton>
        ) : (
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
        )}
      </div>
    </div>
  );
}
