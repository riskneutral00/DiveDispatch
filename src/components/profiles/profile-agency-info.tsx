import { Fragment } from "react";
import { Plus } from "lucide-react";

import { SpecialtyField } from "@/components/profiles/specialty-field";
import { NumberPicker } from "@/components/ui/number-picker";
import { InlineError } from "@/components/ui/inline-error";
import { FormSectionHeader } from "@/components/ui/form-section-header";
import { Button } from "@/components/ui/button";
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
import { makeDefaultAgentAssociation } from "@/lib/schemas/profile-shared";

export type ProfileAgencyInfoVariant = "dive-center" | "agent";

type AgencyRow = Record<string, unknown>;

export interface ProfileAgencyInfoProps<TItem extends AgencyRow = AgencyRow> {
  variant: ProfileAgencyInfoVariant;
  items: TItem[];
  onChange: (items: TItem[]) => void;
  errors?: Record<string, string>;
  makeRow?: () => TItem;
}

export function ProfileAgencyInfo<TItem extends AgencyRow = AgencyRow>({
  variant,
  items,
  onChange,
  errors = {},
  makeRow,
}: ProfileAgencyInfoProps<TItem>) {
  const isAgent = variant === "agent";
  const isCenter = variant === "dive-center";

  const sectionLabel = "Affiliations";
  const addLabel = "Add";
  const emptyMessage = "No affiliations yet. Tap Add to get started.";

  const keys = useStableKeys(items);

  function handleAdd() {
    const next = makeRow ? makeRow() : (makeDefaultAgentAssociation() as unknown as TItem);
    onChange([...items, next]);
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
            <NumberPicker
              label={
                agencyPrefix?.courses.find((c: AgencyCourse) => c.code === "OW")
                  ?.label ?? "OW"
              }
              value={(item as AgencyRow).owDays as number | undefined}
              min={COURSE_DAY_RANGES.OW.min}
              max={COURSE_DAY_RANGES.OW.max}
              onChange={(v) => handleUpdate(idx, { owDays: v })}
              required
              error={errors[`associations.${idx}.owDays`]}
            />
            <NumberPicker
              label={
                agencyPrefix?.courses.find(
                  (c: AgencyCourse) => c.code === "AOW",
                )?.label ?? "AOW"
              }
              value={(item as AgencyRow).aowDays as number | undefined}
              min={COURSE_DAY_RANGES.AOW.min}
              max={COURSE_DAY_RANGES.AOW.max}
              onChange={(v) => handleUpdate(idx, { aowDays: v })}
              required
              error={errors[`associations.${idx}.aowDays`]}
            />
            <NumberPicker
              label={agencyPrefix?.combinedLabel ?? "O+A"}
              value={(item as AgencyRow).oaDays as number | undefined}
              min={COURSE_DAY_RANGES.combined.min}
              max={COURSE_DAY_RANGES.combined.max}
              onChange={(v) => handleUpdate(idx, { oaDays: v })}
              required
              error={errors[`associations.${idx}.oaDays`]}
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

  function renderVariantFields(item: AgencyRow, idx: number) {
    if (isCenter) return renderDiveCenterFields(item, idx);
    return renderAgentFields(item, idx);
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
