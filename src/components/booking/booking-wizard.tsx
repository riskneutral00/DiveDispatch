"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { ROLE_BY_KEY, type RoleKey } from "@/lib/constants/roles";
import { GlassCard, GlassButton, ErrorAlert } from "@/components/ui";
import { SendPortalLink } from "./send-portal-link";
import { parseConvexError } from "@/lib/utils/convex-error";
import { WizardProgress } from "./wizard-progress";
import { CustomerStep } from "./customer-step";
import { Spinner } from "@/components/ui/spinner";
import {
  serializeDraftState,
  WIZARD_STEPS,
  canAdvanceFromCustomers,
  canAdvanceFromItinerary,
  type WizardStep,
  type BookingPreFill,
} from "@/lib/booking/wizard-state";
import { useBookingWizardModel } from "@/lib/hooks/use-booking-wizard-model";
import { useBookingWizardData } from "@/lib/hooks/use-booking-wizard-data";
import { useBookingWizardEffects } from "@/lib/hooks/use-booking-wizard-effects";
import type { Id } from "../../../convex/_generated/dataModel";

const ItineraryStep = dynamic(
  () => import("./itinerary-step").then((m) => ({ default: m.ItineraryStep })),
  { ssr: false, loading: () => <Spinner /> },
);

const ReviewStep = dynamic(
  () => import("./review-step").then((m) => ({ default: m.ReviewStep })),
  { ssr: false, loading: () => <Spinner /> },
);

interface BookingWizardProps {
  bookingId?: string;
  mode?: "page" | "overlay";
  onClose?: () => void;
  onComplete?: () => void;
  initialCourses?: string[];
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
  const t = useTranslations("booking");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const roleSlug = params?.roleSlug as string | undefined;
  const activeRole = roleSlug
    ? ROLE_BY_KEY[roleSlug as RoleKey]?.clerkRole
    : undefined;
  const isEditMode = !!initialBookingId;
  const isOverlay = mode === "overlay";

  const { state, dispatch, initializedRef } =
    useBookingWizardModel(initialBookingId);

  const data = useBookingWizardData({
    state,
    isEditMode,
    initialBookingId,
  });

  const {
    createDraftShell,
    saveDraftState,
    discardDraft,
    editBooking,
    convexUserForPortal,
    existingBooking,
    autoSaveError,
    cancelPending,
  } = data;

  useBookingWizardEffects({
    isEditMode,
    isOverlay,
    initialBookingId,
    initialCourses,
    initialPreFill,
    onComplete,
    state,
    dispatch,
    initializedRef,
    existingBooking,
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editResetError, setEditResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [portalDraftBusy, setPortalDraftBusy] = useState(false);

  const showEditConfirm =
    isEditMode &&
    !isResetting &&
    existingBooking != null &&
    (existingBooking.status === "Upcoming" ||
      existingBooking.status === "Completed");

  const isInitializing =
    isEditMode && (existingBooking === undefined || isResetting);

  async function handleConfirmEdit() {
    if (!initialBookingId) return;
    setEditResetError(null);
    setIsResetting(true);
    try {
      await editBooking({ bookingId: initialBookingId as Id<"bookings"> });
    } catch (err: unknown) {
      setEditResetError(
        parseConvexError(err, t("wizard.errors.resetBooking")),
      );
      setIsResetting(false);
    }
  }

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

  const currentIndex = WIZARD_STEPS.indexOf(state.step);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1;

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
      let currentBookingId = state.bookingId;
      if (
        !currentBookingId &&
        !isEditMode &&
        state.step === "itinerary" &&
        targetStep === "review"
      ) {
        currentBookingId = await createDraftShell({
          activeRole: activeRole!,
          startDate: state.startDate,
          endDate: state.endDate,
        });
        dispatch({ type: "SET_BOOKING_ID", payload: currentBookingId });
      }

      if (
        state.step === "itinerary" &&
        targetStep === "review" &&
        state.sameForAll &&
        state.customers.length > 1
      ) {
        dispatch({ type: "COPY_COURSE_ENTRIES_TO_ALL" });
      }

      if (currentBookingId) {
        const stateSnapshot = { ...state, bookingId: currentBookingId };
        await saveDraftState({
          bookingId: currentBookingId as Id<"bookings">,
          draftState: serializeDraftState(stateSnapshot),
        });
      }
    } catch (err: unknown) {
      setSaveError(parseConvexError(err, t("wizard.errors.saveProgress")));
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

  async function ensureDraftForPortalLink(): Promise<string | null> {
    if (state.bookingId) return state.bookingId;
    if (!activeRole) return null;
    setPortalDraftBusy(true);
    try {
      const id = await createDraftShell({ activeRole });
      dispatch({ type: "SET_BOOKING_ID", payload: id });
      return id;
    } catch {
      return null;
    } finally {
      setPortalDraftBusy(false);
    }
  }

  function renderCustomerPortalSend() {
    if (state.step !== "customers" || isEditMode) return null;
    const c0 = state.customers[0];
    if (!c0?.name?.trim() || !canAdvanceFromCustomers(state.customers))
      return null;
    const contact = c0.contact;
    const contactType = contact?.whatsapp
      ? ("whatsapp" as const)
      : contact?.line
        ? ("line" as const)
        : contact?.email
          ? ("email" as const)
          : undefined;
    const contactValue =
      contact?.whatsapp ?? contact?.line ?? contact?.email ?? "";
    const emailForResend =
      contactType === "email" ? contactValue : (contact?.email ?? "");

    if (!state.bookingId) {
      return (
        <div className="mt-4">
          <GlassButton
            variant="secondary"
            size="sm"
            type="button"
            loading={portalDraftBusy}
            onClick={() => void ensureDraftForPortalLink()}
          >
            {t("wizard.preparePortalLink")}
          </GlassButton>
          <p
            className="text-xs mt-2 text-secondary"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {t("wizard.preparePortalHint")}
          </p>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-2">
        <p
          className="text-xs font-medium text-secondary"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {t("wizard.portalLinkDelivery")}
        </p>
        <SendPortalLink
          bookingId={state.bookingId as Id<"bookings">}
          customerName={c0.name}
          email={emailForResend}
          operatorName={
            convexUserForPortal?.businessName ?? t("wizard.operatorFallback")
          }
          contactType={contactType}
          contactValue={contactValue || undefined}
        />
      </div>
    );
  }

  function renderStepContent() {
    switch (state.step) {
      case "customers":
        return (
          <>
            <CustomerStep customers={state.customers} dispatch={dispatch} />
            {renderCustomerPortalSend()}
          </>
        );
      case "itinerary":
        return (
          <ItineraryStep
            state={state}
            dispatch={dispatch}
            isEditMode={isEditMode}
          />
        );
      case "review":
        return (
          <ReviewStep
            state={state}
            dispatch={dispatch}
            isEditMode={isEditMode}
          />
        );
      default:
        return null;
    }
  }

  const bookingRef = initialBookingId
    ? `#${initialBookingId.slice(-8).toUpperCase()}`
    : state.bookingId
      ? `#${state.bookingId.slice(-8).toUpperCase()}`
      : null;

  const advanceDisabled = !canAdvance();
  const isReviewStep = state.step === "review";

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
                  className="text-lg font-semibold text-primary"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {t("wizard.editConfirmTitle")}
                </h2>
                <p
                  className="text-sm mt-1 text-secondary"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {t("wizard.editConfirmBody")}
                </p>
              </div>
            </div>
            {editResetError && (
              <ErrorAlert>{editResetError}</ErrorAlert>
            )}
            <div className="flex gap-3">
              <GlassButton
                variant="primary"
                size="md"
                onClick={() => void handleConfirmEdit()}
              >
                {t("wizard.editConfirmYes")}
              </GlassButton>
              <GlassButton
                variant="secondary"
                size="md"
                onClick={() => router.back()}
              >
                {tCommon("cancel")}
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
        className="max-w-3xl mx-auto px-4 py-16 flex items-center justify-center text-secondary"
      >
        <Spinner label={t("wizard.preparing")} />
      </div>
    );
  }

  if (isOverlay) {
    return (
      <div className="px-4 py-4 sm:px-6">
        {bookingRef && (
          <p
            className="text-xs font-mono mb-3 text-secondary"
          >
            {bookingRef}
          </p>
        )}

        <WizardProgress currentStep={state.step} />

        <div className="mt-4">{renderStepContent()}</div>

        {saveError && (
          <ErrorAlert className="mt-3">{saveError}</ErrorAlert>
        )}
        {autoSaveError && !saveError && !isReviewStep && (
          <p className="mt-3 text-xs text-secondary">
            {autoSaveError}
          </p>
        )}

        {!isReviewStep && (
          <div className="flex justify-between items-center mt-4 gap-4">
            <GlassButton
              variant="secondary"
              onClick={isFirstStep ? () => void handleCancel() : handleBack}
              disabled={isSaving}
              size="md"
            >
              <ChevronLeft size={16} />
              {isFirstStep ? tCommon("cancel") : tCommon("back")}
            </GlassButton>

            <GlassButton
              variant="primary"
              onClick={handleNext}
              disabled={advanceDisabled || isSaving}
              loading={isSaving}
              size="md"
            >
              {tCommon("next")}
              <ChevronRight size={16} />
            </GlassButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {isEditMode && bookingRef
              ? t("wizard.editingTitle", { ref: bookingRef })
              : t("new")}
          </h1>
          <GlassButton
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => void handleCancel()}
            disabled={state.submitting}
            className="rounded-full"
            aria-label={t("wizard.cancelBookingAria")}
          >
            <X size={16} />
          </GlassButton>
        </div>
        {bookingRef && (
          <p
            className="text-xs font-mono mt-1 text-secondary"
          >
            {bookingRef}
          </p>
        )}
      </div>

      <WizardProgress currentStep={state.step} />

      <div className="mt-6">{renderStepContent()}</div>

      {saveError && (
        <ErrorAlert className="mt-3">{saveError}</ErrorAlert>
      )}
      {autoSaveError && !saveError && !isReviewStep && (
        <p
          className="mt-3 text-xs text-secondary"
        >
          {autoSaveError}
        </p>
      )}

      {!isReviewStep && (
        <div className="flex justify-between items-center mt-6 gap-4">
          <GlassButton
            variant="secondary"
            onClick={isFirstStep ? () => void handleCancel() : handleBack}
            disabled={isSaving}
            size="md"
          >
            <ChevronLeft size={16} />
            {isFirstStep ? tCommon("cancel") : tCommon("back")}
          </GlassButton>

          <GlassButton
            variant="primary"
            onClick={handleNext}
            disabled={advanceDisabled || isSaving}
            loading={isSaving}
            size="md"
          >
            {tCommon("next")}
            <ChevronRight size={16} />
          </GlassButton>
        </div>
      )}
    </div>
  );
}
