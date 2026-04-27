import { Fragment } from "react";
import { Plus } from "lucide-react";

import { SpecialtyField } from "@/components/profiles/specialty-field";
import { DayPicker } from "@/components/ui/day-picker";
import { InlineError } from "@/components/ui/inline-error";
import { FormSectionHeader } from "@/components/ui/form-section-header";
import { Button } from "@/components/ui/button";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { FieldLabel } from "@/components/ui/field-shell";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { FieldRow } from "@/components/ui/field-row";
import { ItemCard } from "@/components/ui/item-card";
import { useStableKeys } from "@/lib/hooks/use-stable-keys";
import {
  AGENCIES,
  AGENCY_CODES,
  COURSE_DAY_RANGES,
  DIVE_AGENCIES,
  getDefaultSpecialties,
  type AgencyCourse,
} from "@/lib/constants/agencies";

export type ProfileAgencyInfoVariant =
  | "dive-center"
  | "agent"
  | "instructor";

type AgencyRow = Record<string, unknown>;

export interface ProfileAgencyInfoProps<TItem extends AgencyRow = AgencyRow> {
  variant: ProfileAgencyInfoVariant;
  items: TItem[];
  onChange: (items: TItem[]) => void;
  errors?: Record<string, string>;
}

export function ProfileAgencyInfo<TItem extends AgencyRow = AgencyRow>({
  variant,
  items,
  onChange,
  errors = {},
}: ProfileAgencyInfoProps<TItem>) {
  const isPro = variant === "instructor";
  const isAgent = variant === "agent";
  const isCenter = variant === "dive-center";

  const sectionLabel = isPro ? "Dive Credentials" : "Affiliations";
  const addLabel = isPro ? "Add Credential" : "Add";
  const emptyMessage = isPro
    ? "No credentials yet. Tap Add to get started."
    : "No affiliations yet. Tap Add to get started.";

  const keys = useStableKeys(items);

  function makeDefaultItem() {
    if (isCenter) {
      return {
        agency: "",
        number: "",
        owDays: COURSE_DAY_RANGES.OW.min,
        aowDays: COURSE_DAY_RANGES.AOW.min,
        oaDays: COURSE_DAY_RANGES.combined.min,
        selectedSpecialties: getDefaultSpecialties("PADI"),
      };
    }
    if (isAgent) {
      return { agency: "", number: "" };
    }
    return {
      agency: "",
      level: "",
      agencyID: "",
      specialtyRatings: [],
    };
  }

  function handleAdd() {
    onChange([...items, makeDefaultItem() as unknown as TItem]);
  }

  function handleRemove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function handleUpdate(idx: number, patch: Record<string, unknown>) {
    const newItems = [...items] as TItem[];
    const updated = { ...(newItems[idx] as AgencyRow), ...patch } as TItem;

    if (
      isCenter &&
      patch.agency &&
      patch.agency !== (newItems[idx] as AgencyRow).agency
    ) {
      (updated as AgencyRow).selectedSpecialties = getDefaultSpecialties(
        String(patch.agency),
      );
    }

    if (isPro && "agency" in patch) {
      (updated as AgencyRow).level = "";
      (updated as AgencyRow).agencyID = "";
    } else if (isPro && "level" in patch) {
      (updated as AgencyRow).agencyID = "";
    }

    newItems[idx] = updated;
    onChange(newItems);
  }

  function renderDiveCenterFields(item: AgencyRow, idx: number) {
    const agencyPrefix = AGENCIES[item.agency as keyof typeof AGENCIES];
    return (
      <div className="flex flex-col gap-4 items-start">
        <FieldRow>
          <SimpleSelect
            label="Agency"
            value={String((item as AgencyRow).agency ?? "")}
            onChange={(v) => handleUpdate(idx, { agency: v })}
            options={AGENCY_CODES.filter(
              (code) =>
                code === item.agency ||
                !items.some((a, i) => i !== idx && a.agency === code),
            ).map((code) => ({
              value: code,
              label: AGENCIES[code as keyof typeof AGENCIES].name,
            }))}
            required
            className="field-md"
          />
          <Input
            label="Member Number"
            value={String((item as AgencyRow).number ?? "")}
            onChange={(e) => handleUpdate(idx, { number: e.target.value })}
            required
            className="field-md"
          />
        </FieldRow>

        <div className="">
          <FieldLabel required className="mb-2">
            Default course days
          </FieldLabel>
          <div className="flex gap-2 reading-plane">
            <DayPicker
              label={
                agencyPrefix?.courses.find((c: AgencyCourse) => c.code === "OW")
                  ?.label ?? "OW"
              }
              value={Number((item as AgencyRow).owDays)}
              min={COURSE_DAY_RANGES.OW.min}
              max={COURSE_DAY_RANGES.OW.max}
              onChange={(v) => handleUpdate(idx, { owDays: v })}
            />
            <DayPicker
              label={
                agencyPrefix?.courses.find(
                  (c: AgencyCourse) => c.code === "AOW",
                )?.label ?? "AOW"
              }
              value={Number((item as AgencyRow).aowDays)}
              min={COURSE_DAY_RANGES.AOW.min}
              max={COURSE_DAY_RANGES.AOW.max}
              onChange={(v) => handleUpdate(idx, { aowDays: v })}
            />
            <DayPicker
              label={agencyPrefix?.combinedLabel ?? "O+A"}
              value={Number((item as AgencyRow).oaDays)}
              min={COURSE_DAY_RANGES.combined.min}
              max={COURSE_DAY_RANGES.combined.max}
              onChange={(v) => handleUpdate(idx, { oaDays: v })}
            />
          </div>
        </div>
        <div className=" w-full">
          <SpecialtyField
            agencyCode={String((item as AgencyRow).agency ?? "")}
            value={
              ((item as AgencyRow).selectedSpecialties as
                | string[]
                | undefined) ?? []
            }
            onChange={(specialties) =>
              handleUpdate(idx, { selectedSpecialties: specialties })
            }
          />
        </div>
      </div>
    );
  }

  function renderAgentFields(item: AgencyRow, idx: number) {
    return (
      <div className="flex flex-wrap gap-3 mb-4 ">
        <SimpleSelect
          label="Agency"
          value={String((item as AgencyRow).agency ?? "")}
          onChange={(v) => handleUpdate(idx, { agency: v })}
          options={DIVE_AGENCIES}
          error={errors[`associations.${idx}.agency`]}
          required
          className="field-sm"
        />
        <Input
          label="Agency Member ID"
          value={String((item as AgencyRow).number ?? "")}
          onChange={(e) => handleUpdate(idx, { number: e.target.value })}
          error={errors[`associations.${idx}.number`]}
          required
          className="field-md"
        />
      </div>
    );
  }

  function renderProFields(item: AgencyRow, idx: number) {
    const selectedAgency = String((item as AgencyRow).agency ?? "");
    const selectedLevel = String((item as AgencyRow).level ?? "");
    const agencyDef = selectedAgency ? AGENCIES[selectedAgency] : undefined;
    const levelOptions = (agencyDef ?? AGENCIES["PADI"]).levels.map(
      (l) => l.code,
    );
    const ratingItems = (agencyDef?.specialties ?? [])
      .filter((s) => s.specialtyCourseName !== null)
      .map((s) => ({ value: s.code, label: s.label }));

    return (
      <Fragment>
        <div className="flex flex-wrap gap-3 mb-4 ">
          <SimpleSelect
            label="Agency"
            value={selectedAgency}
            onChange={(v) => handleUpdate(idx, { agency: v })}
            options={DIVE_AGENCIES}
            error={errors[`credential.${idx}.agency`]}
            required
            className="field-sm"
          />
          <SimpleSelect
            label="Level"
            value={selectedLevel}
            onChange={(v) => handleUpdate(idx, { level: v })}
            options={levelOptions}
            error={errors[`credential.${idx}.level`]}
            required
            disabled={!selectedAgency}
            className="field-sm"
          />
          <Input
            label="Agency ID"
            helperText={agencyDef?.memberIdLabel}
            value={String((item as AgencyRow).agencyID ?? "")}
            onChange={(e) => handleUpdate(idx, { agencyID: e.target.value })}
            error={errors[`credential.${idx}.agencyID`]}
            className="field-md"
            required
            disabled={!selectedAgency || !selectedLevel}
          />
        </div>
        {variant === "instructor" && (
          <div
            className={
              ratingItems.length > 0
                ? "opacity-100"
                : "opacity-0 h-0 overflow-hidden"
            }
          >
            <CheckboxGroup
              label="Specialty Instructor Ratings"
              items={ratingItems}
              selected={
                ((item as AgencyRow).specialtyRatings as
                  | string[]
                  | undefined) ?? []
              }
              onChange={(values) =>
                handleUpdate(idx, { specialtyRatings: values })
              }
              error={errors[`credential.${idx}.specialtyRatings`]}
              columns={3}
            />
          </div>
        )}
      </Fragment>
    );
  }

  function renderVariantFields(item: AgencyRow, idx: number) {
    if (isCenter) return renderDiveCenterFields(item, idx);
    if (isAgent) return renderAgentFields(item, idx);
    return renderProFields(item, idx);
  }

  return (
    <div className="space-y-4">
      {!isCenter && (
        <FormSectionHeader
          label={sectionLabel}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAdd}
            >
              <Plus size={14} />
              {addLabel}
            </Button>
          }
        />
      )}

      {errors.associations && <InlineError>{errors.associations}</InlineError>}
      {errors.credential && <InlineError>{errors.credential}</InlineError>}

      {items.length === 0 ? (
        <p className="text-body text-secondary">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <Fragment key={keys[idx]}>
              <ItemCard
                onRemove={() => handleRemove(idx)}
                canRemove={isAgent ? true : items.length > 1}
                aria-label={`Remove ${sectionLabel.toLowerCase()}`}
              >
                {renderVariantFields(item, idx)}
              </ItemCard>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
