"use client";

import { type LocationValue } from "@/components/profiles/location-picker-lazy";
import { ProfileAgencyInfo } from "@/components/profiles/profile-agency-info";
import { SectionDivider } from "@/components/ui/section-divider";
import { ProfileBasicInfo } from "@/components/profiles/profile-basic-info";
import { LanguageField } from "@/components/ui/language-field";
import { FormSectionHeader } from "@/components/ui/form-section-header";
import { ProfileFormShell } from "@/components/profiles/profile-form-shell";
import {
  INITIAL_ACCESS_CONTROL,
  accessFromProfile,
  accessToPayload,
  type AccessControlState,
} from "@/components/profiles/access-control-section";
import {
  type ContactFormState,
  INITIAL_CONTACT_FORM as BASE_INITIAL_CONTACT,
  INITIAL_CUSTOMER_LANGUAGES,
  buildParentContactDefaults,
  contactFromProfile as baseContactFromProfile,
  contactToPayload as baseContactToPayload,
  defaultFromMe,
  languagesFromProfile,
  languagesToPayload,
  type BaseProfileSectionProps,
} from "@/lib/profile-form";
import { useProfileForm } from "@/lib/hooks/use-profile-form";
import {
  agentContactMergedSchema,
  agentAssociationsSchema,
  associationSchema,
} from "@/lib/schemas/profile-shared";
import type { Language } from "@/lib/types/language";
import { z } from "zod";

export type AgentProfileSection = "contact" | "associations";

type AssociationData = z.infer<typeof associationSchema>;

export type AgentContactFormState = ContactFormState & { // dry-ok
  customerLanguages: Language[];
  access: AccessControlState;
};

export type AgentAssociationsFormState = {
  associations: AssociationData[];
};

export const INITIAL_CONTACT_FORM: AgentContactFormState = {
  ...BASE_INITIAL_CONTACT,
  ...INITIAL_CUSTOMER_LANGUAGES,
  access: INITIAL_ACCESS_CONTROL,
};

export const INITIAL_LANGUAGES_FORM = INITIAL_CUSTOMER_LANGUAGES;

export const INITIAL_ASSOCIATIONS_FORM: AgentAssociationsFormState = {
  associations: [],
};

export function contactFromProfile(
  p: Record<string, unknown>,
): AgentContactFormState {
  return {
    ...baseContactFromProfile(p),
    ...INITIAL_CUSTOMER_LANGUAGES,
    access: accessFromProfile(p),
  };
}

function contactFromProfileMerged(
  p: Record<string, unknown>,
  me?: Record<string, unknown> | null,
): AgentContactFormState {
  return {
    ...contactFromProfile(p),
    customerLanguages: languagesFromProfile(
      (me as { customerLanguages?: string[] } | undefined)?.customerLanguages,
    ),
  };
}

function agentMergedFromMe(
  u: Record<string, unknown>,
  defaults: AgentContactFormState,
): AgentContactFormState {
  return {
    ...defaultFromMe(u, defaults),
    customerLanguages: languagesFromProfile(
      (u as { customerLanguages?: string[] }).customerLanguages,
    ),
    access: defaults.access,
  };
}

export function contactToPayload(
  f: AgentContactFormState,
): Record<string, unknown> {
  return {
    ...baseContactToPayload(f),
    ...accessToPayload(f.access),
  };
}

export function associationsFromProfile(
  p: Record<string, unknown>,
): AgentAssociationsFormState {
  return {
    associations: (
      (p.associations as Array<Record<string, unknown>>) ?? []
    ).map((a) => ({
      agency: String(a.agency ?? ""),
      number: String(a.number ?? ""),
    })),
  };
}

export function associationsToPayload(
  f: AgentAssociationsFormState,
): Record<string, unknown> {
  return {
    associations: f.associations.map(({ agency, number }) => ({
      agency,
      number,
    })),
  };
}

type AgentContactSectionProps = BaseProfileSectionProps & {
  updateProfile: (payload: Record<string, unknown>) => Promise<unknown>;
  preferredOperatorSlug?: string | null;
};

export type AgentAssociationsSectionProps = Pick<
  BaseProfileSectionProps,
  "profile" | "me" | "create" | "update"
> & { onClose?: () => void };

export function AgentContactSection({
  profile,
  me,
  create,
  update,
  updateProfile,
  onClose,
  preferredOperatorSlug,
}: AgentContactSectionProps) {
  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...payload, associations: [] });

  const {
    form,
    setField,
    errors,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    loading,
    isUpdate,
    handleSubmit,
    resetToBaseline,
  } = useProfileForm({
    profile,
    me,
    schema: agentContactMergedSchema,
    defaults: INITIAL_CONTACT_FORM,
    fromProfile: contactFromProfileMerged,
    fromMe: agentMergedFromMe,
    toPayload: contactToPayload,
    create: createOverride,
    update,
    afterSuccessfulSave: async (f) => {
      await updateProfile({
        customerLanguages: languagesToPayload(f.customerLanguages),
      });
    },
  });

  const onLocationChange = (loc: LocationValue | null) =>
    setField("location", loc);

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => {
        resetToBaseline();
        onClose?.();
      }}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <div className="space-y-4">
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField("name", val)}
          nameError={errors.name}
          nameLabel="Business Name"
          nameRequired
          locationValue={form.location}
          onLocationChange={onLocationChange}
          locationError={errors.location}
          locationRequired
          emailValue={form.email}
          onEmailChange={(val) => setField("email", val)}
          emailError={errors.email}
          emailRequired
          phoneValue={form.phone}
          onPhoneChange={(val) => setField("phone", val)}
          phoneError={errors.phone}
          phoneRequired
        />
      </div>

      <SectionDivider show />

      <div>
        <FormSectionHeader label="Default Referral" />
        <p className="text-label mt-2 text-secondary">
          {preferredOperatorSlug
            ? "Bookings cascade from your preferred operator. Change in Preferences → Resources → Operator."
            : "You create and manage bookings independently."}
        </p>
      </div>

      <SectionDivider variant="soft" />

      <LanguageField
        variant="customer"
        value={form.customerLanguages}
        onChange={(langs) => setField("customerLanguages", langs)}
      />
    </ProfileFormShell>
  );
}

export function AgentAssociationsSection({
  profile,
  me,
  create,
  update,
  onClose,
}: AgentAssociationsSectionProps) {
  const createOverride = (payload: Record<string, unknown>) =>
    create({ ...buildParentContactDefaults(me), ...payload });

  const {
    form,
    setField,
    errors,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    loading,
    isUpdate,
    handleSubmit,
    resetToBaseline,
  } = useProfileForm({
    profile,
    schema: agentAssociationsSchema,
    defaults: INITIAL_ASSOCIATIONS_FORM,
    fromProfile: associationsFromProfile,
    toPayload: associationsToPayload,
    create: createOverride,
    update,
  });

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={() => {
        resetToBaseline();
        onClose?.();
      }}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="space-y-6"
    >
      <ProfileAgencyInfo
        variant="agent"
        items={form.associations}
        onChange={(items) => setField("associations", items)}
        errors={errors as Record<string, string>}
      />
    </ProfileFormShell>
  );
}

type AgentProfileFormProps = {
  section?: AgentProfileSection;
  profile: Record<string, unknown> | null | undefined;
  me: Record<string, unknown> | null | undefined;
  create: (payload: Record<string, unknown>) => Promise<unknown>;
  update: (payload: Record<string, unknown>) => Promise<unknown>;
  updateProfile: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
  preferredOperatorSlug?: string | null;
};

export function AgentProfileForm({
  section,
  profile,
  me,
  create,
  update,
  updateProfile,
  onClose,
  preferredOperatorSlug,
}: AgentProfileFormProps) {
  if (section === "associations")
    return (
      <AgentAssociationsSection
        profile={profile}
        me={me}
        create={create}
        update={update}
        onClose={onClose}
      />
    );
  return (
    <AgentContactSection
      profile={profile}
      me={me}
      create={create}
      update={update}
      updateProfile={updateProfile}
      onClose={onClose}
      preferredOperatorSlug={preferredOperatorSlug}
    />
  );
}
