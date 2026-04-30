/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_auditOrgRelationships from "../admin/auditOrgRelationships.js";
import type * as admin_backfillPermissionLevels from "../admin/backfillPermissionLevels.js";
import type * as admin_bindOrgClerkOrgId from "../admin/bindOrgClerkOrgId.js";
import type * as admin_promoteAreaOrg from "../admin/promoteAreaOrg.js";
import type * as admin_rebindOrgClerkOrgId from "../admin/rebindOrgClerkOrgId.js";
import type * as admin_restoreOrg from "../admin/restoreOrg.js";
import type * as admin_upsertVenue from "../admin/upsertVenue.js";
import type * as agents from "../agents.js";
import type * as availability from "../availability.js";
import type * as backfill_autoAcceptFromAcceptanceMode from "../backfill/autoAcceptFromAcceptanceMode.js";
import type * as backfill_credentialSpecialtyRatings from "../backfill/credentialSpecialtyRatings.js";
import type * as backfill_entityProfileComplete from "../backfill/entityProfileComplete.js";
import type * as backfill_entitySlugs from "../backfill/entitySlugs.js";
import type * as backfill_equipmentManufacturers from "../backfill/equipmentManufacturers.js";
import type * as backfill_personalOrgs from "../backfill/personalOrgs.js";
import type * as backfill_stripUserVestigial from "../backfill/stripUserVestigial.js";
import type * as boatWidget from "../boatWidget.js";
import type * as boats from "../boats.js";
import type * as bookingDraftMutations from "../bookingDraftMutations.js";
import type * as bookingLinks from "../bookingLinks.js";
import type * as bookingResources from "../bookingResources.js";
import type * as bookingTemplates from "../bookingTemplates.js";
import type * as bookings from "../bookings.js";
import type * as bookings__shared from "../bookings/_shared.js";
import type * as bookings_autoAdvance from "../bookings/autoAdvance.js";
import type * as bookings_create from "../bookings/create.js";
import type * as bookings_dev from "../bookings/dev.js";
import type * as bookings_edit from "../bookings/edit.js";
import type * as bookings_inventoryRelease from "../bookings/inventoryRelease.js";
import type * as bookings_snapshotKeys from "../bookings/snapshotKeys.js";
import type * as bookings_stateMachine from "../bookings/stateMachine.js";
import type * as bookings_status from "../bookings/status.js";
import type * as completeness from "../completeness.js";
import type * as compressors from "../compressors.js";
import type * as crons from "../crons.js";
import type * as customerProfiles from "../customerProfiles.js";
import type * as customers from "../customers.js";
import type * as demoBookings from "../demoBookings.js";
import type * as devSwitcher from "../devSwitcher.js";
import type * as directory from "../directory.js";
import type * as diveCenters from "../diveCenters.js";
import type * as diveStaff from "../diveStaff.js";
import type * as email from "../email.js";
import type * as equipment from "../equipment.js";
import type * as equipmentInventory from "../equipmentInventory.js";
import type * as equipmentWidget from "../equipmentWidget.js";
import type * as gearSizingLookup from "../gearSizingLookup.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as lib_activeOrg from "../lib/activeOrg.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_batch from "../lib/batch.js";
import type * as lib_completeness_evaluators from "../lib/completeness/evaluators.js";
import type * as lib_completeness_operatorEvaluators from "../lib/completeness/operatorEvaluators.js";
import type * as lib_completeness_perRow from "../lib/completeness/perRow.js";
import type * as lib_completeness_resolveProfile from "../lib/completeness/resolveProfile.js";
import type * as lib_completeness_roleSpecs from "../lib/completeness/roleSpecs.js";
import type * as lib_completeness_types from "../lib/completeness/types.js";
import type * as lib_constantTimeEqual from "../lib/constantTimeEqual.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_defaultThemes from "../lib/defaultThemes.js";
import type * as lib_destinationScope from "../lib/destinationScope.js";
import type * as lib_devGuard from "../lib/devGuard.js";
import type * as lib_diveStaffHelpers from "../lib/diveStaffHelpers.js";
import type * as lib_ensureSystemThemes from "../lib/ensureSystemThemes.js";
import type * as lib_entitySlug from "../lib/entitySlug.js";
import type * as lib_equipmentBags from "../lib/equipmentBags.js";
import type * as lib_equipmentGearCompleteness from "../lib/equipmentGearCompleteness.js";
import type * as lib_equipmentManufacturersSync from "../lib/equipmentManufacturersSync.js";
import type * as lib_errorCodes from "../lib/errorCodes.js";
import type * as lib_fsm from "../lib/fsm.js";
import type * as lib_gasMixValidation from "../lib/gasMixValidation.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_inventoryCleanup from "../lib/inventoryCleanup.js";
import type * as lib_languageMatch from "../lib/languageMatch.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_orgCascade from "../lib/orgCascade.js";
import type * as lib_portal from "../lib/portal.js";
import type * as lib_profileCompleteness from "../lib/profileCompleteness.js";
import type * as lib_profileHelpers from "../lib/profileHelpers.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as lib_requiredFields from "../lib/requiredFields.js";
import type * as lib_rolePrecedence from "../lib/rolePrecedence.js";
import type * as lib_safeDbOps from "../lib/safeDbOps.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_seedUtils from "../lib/seedUtils.js";
import type * as lib_setRoleProfileComplete from "../lib/setRoleProfileComplete.js";
import type * as lib_snapshotFields from "../lib/snapshotFields.js";
import type * as lib_stakeholderPreferencesDedupe from "../lib/stakeholderPreferencesDedupe.js";
import type * as lib_themeOrdering from "../lib/themeOrdering.js";
import type * as lib_timeConstants from "../lib/timeConstants.js";
import type * as lib_tokenIdentifier from "../lib/tokenIdentifier.js";
import type * as lib_typedDb from "../lib/typedDb.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_userOrg from "../lib/userOrg.js";
import type * as lib_userRebind from "../lib/userRebind.js";
import type * as lib_userRoleHelpers from "../lib/userRoleHelpers.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_webhookTimestamp from "../lib/webhookTimestamp.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as parkedData from "../parkedData.js";
import type * as portalDraft from "../portalDraft.js";
import type * as portalSubmission from "../portalSubmission.js";
import type * as reconciliation from "../reconciliation.js";
import type * as reservationsMutations from "../reservationsMutations.js";
import type * as resourceQueries from "../resourceQueries.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";
import type * as seedExport from "../seedExport.js";
import type * as shared_activityCatalog from "../shared/activityCatalog.js";
import type * as shared_addressValidator from "../shared/addressValidator.js";
import type * as shared_agencies from "../shared/agencies.js";
import type * as shared_aowSelection from "../shared/aowSelection.js";
import type * as shared_boatTypes from "../shared/boatTypes.js";
import type * as shared_bookingExpiry from "../shared/bookingExpiry.js";
import type * as shared_capabilityGate from "../shared/capabilityGate.js";
import type * as shared_courseCodes from "../shared/courseCodes.js";
import type * as shared_coverageValidation from "../shared/coverageValidation.js";
import type * as shared_dateRange from "../shared/dateRange.js";
import type * as shared_diopters from "../shared/diopters.js";
import type * as shared_enumValidator from "../shared/enumValidator.js";
import type * as shared_gasMixes from "../shared/gasMixes.js";
import type * as shared_gearRequiredFields from "../shared/gearRequiredFields.js";
import type * as shared_gearSizing from "../shared/gearSizing.js";
import type * as shared_i18nConstants from "../shared/i18nConstants.js";
import type * as shared_notificationLogistics from "../shared/notificationLogistics.js";
import type * as shared_operatorTypes from "../shared/operatorTypes.js";
import type * as shared_ratioRules from "../shared/ratioRules.js";
import type * as shared_resourceOwnerTypes from "../shared/resourceOwnerTypes.js";
import type * as shared_roleKinds from "../shared/roleKinds.js";
import type * as shared_schemaEnums from "../shared/schemaEnums.js";
import type * as shared_statuses from "../shared/statuses.js";
import type * as shared_tcVersion from "../shared/tcVersion.js";
import type * as shared_venueFeatures from "../shared/venueFeatures.js";
import type * as shared_venueTypes from "../shared/venueTypes.js";
import type * as stakeholderPreferences from "../stakeholderPreferences.js";
import type * as support from "../support.js";
import type * as testHelpers from "../testHelpers.js";
import type * as themes from "../themes.js";
import type * as userRoles from "../userRoles.js";
import type * as users from "../users.js";
import type * as venues from "../venues.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/auditOrgRelationships": typeof admin_auditOrgRelationships;
  "admin/backfillPermissionLevels": typeof admin_backfillPermissionLevels;
  "admin/bindOrgClerkOrgId": typeof admin_bindOrgClerkOrgId;
  "admin/promoteAreaOrg": typeof admin_promoteAreaOrg;
  "admin/rebindOrgClerkOrgId": typeof admin_rebindOrgClerkOrgId;
  "admin/restoreOrg": typeof admin_restoreOrg;
  "admin/upsertVenue": typeof admin_upsertVenue;
  agents: typeof agents;
  availability: typeof availability;
  "backfill/autoAcceptFromAcceptanceMode": typeof backfill_autoAcceptFromAcceptanceMode;
  "backfill/credentialSpecialtyRatings": typeof backfill_credentialSpecialtyRatings;
  "backfill/entityProfileComplete": typeof backfill_entityProfileComplete;
  "backfill/entitySlugs": typeof backfill_entitySlugs;
  "backfill/equipmentManufacturers": typeof backfill_equipmentManufacturers;
  "backfill/personalOrgs": typeof backfill_personalOrgs;
  "backfill/stripUserVestigial": typeof backfill_stripUserVestigial;
  boatWidget: typeof boatWidget;
  boats: typeof boats;
  bookingDraftMutations: typeof bookingDraftMutations;
  bookingLinks: typeof bookingLinks;
  bookingResources: typeof bookingResources;
  bookingTemplates: typeof bookingTemplates;
  bookings: typeof bookings;
  "bookings/_shared": typeof bookings__shared;
  "bookings/autoAdvance": typeof bookings_autoAdvance;
  "bookings/create": typeof bookings_create;
  "bookings/dev": typeof bookings_dev;
  "bookings/edit": typeof bookings_edit;
  "bookings/inventoryRelease": typeof bookings_inventoryRelease;
  "bookings/snapshotKeys": typeof bookings_snapshotKeys;
  "bookings/stateMachine": typeof bookings_stateMachine;
  "bookings/status": typeof bookings_status;
  completeness: typeof completeness;
  compressors: typeof compressors;
  crons: typeof crons;
  customerProfiles: typeof customerProfiles;
  customers: typeof customers;
  demoBookings: typeof demoBookings;
  devSwitcher: typeof devSwitcher;
  directory: typeof directory;
  diveCenters: typeof diveCenters;
  diveStaff: typeof diveStaff;
  email: typeof email;
  equipment: typeof equipment;
  equipmentInventory: typeof equipmentInventory;
  equipmentWidget: typeof equipmentWidget;
  gearSizingLookup: typeof gearSizingLookup;
  healthCheck: typeof healthCheck;
  http: typeof http;
  "lib/activeOrg": typeof lib_activeOrg;
  "lib/alerts": typeof lib_alerts;
  "lib/auditLog": typeof lib_auditLog;
  "lib/auth": typeof lib_auth;
  "lib/batch": typeof lib_batch;
  "lib/completeness/evaluators": typeof lib_completeness_evaluators;
  "lib/completeness/operatorEvaluators": typeof lib_completeness_operatorEvaluators;
  "lib/completeness/perRow": typeof lib_completeness_perRow;
  "lib/completeness/resolveProfile": typeof lib_completeness_resolveProfile;
  "lib/completeness/roleSpecs": typeof lib_completeness_roleSpecs;
  "lib/completeness/types": typeof lib_completeness_types;
  "lib/constantTimeEqual": typeof lib_constantTimeEqual;
  "lib/crypto": typeof lib_crypto;
  "lib/defaultThemes": typeof lib_defaultThemes;
  "lib/destinationScope": typeof lib_destinationScope;
  "lib/devGuard": typeof lib_devGuard;
  "lib/diveStaffHelpers": typeof lib_diveStaffHelpers;
  "lib/ensureSystemThemes": typeof lib_ensureSystemThemes;
  "lib/entitySlug": typeof lib_entitySlug;
  "lib/equipmentBags": typeof lib_equipmentBags;
  "lib/equipmentGearCompleteness": typeof lib_equipmentGearCompleteness;
  "lib/equipmentManufacturersSync": typeof lib_equipmentManufacturersSync;
  "lib/errorCodes": typeof lib_errorCodes;
  "lib/fsm": typeof lib_fsm;
  "lib/gasMixValidation": typeof lib_gasMixValidation;
  "lib/idempotency": typeof lib_idempotency;
  "lib/inventoryCleanup": typeof lib_inventoryCleanup;
  "lib/languageMatch": typeof lib_languageMatch;
  "lib/logger": typeof lib_logger;
  "lib/orgCascade": typeof lib_orgCascade;
  "lib/portal": typeof lib_portal;
  "lib/profileCompleteness": typeof lib_profileCompleteness;
  "lib/profileHelpers": typeof lib_profileHelpers;
  "lib/rateLimiter": typeof lib_rateLimiter;
  "lib/requiredFields": typeof lib_requiredFields;
  "lib/rolePrecedence": typeof lib_rolePrecedence;
  "lib/safeDbOps": typeof lib_safeDbOps;
  "lib/sanitize": typeof lib_sanitize;
  "lib/seedUtils": typeof lib_seedUtils;
  "lib/setRoleProfileComplete": typeof lib_setRoleProfileComplete;
  "lib/snapshotFields": typeof lib_snapshotFields;
  "lib/stakeholderPreferencesDedupe": typeof lib_stakeholderPreferencesDedupe;
  "lib/themeOrdering": typeof lib_themeOrdering;
  "lib/timeConstants": typeof lib_timeConstants;
  "lib/tokenIdentifier": typeof lib_tokenIdentifier;
  "lib/typedDb": typeof lib_typedDb;
  "lib/types": typeof lib_types;
  "lib/userOrg": typeof lib_userOrg;
  "lib/userRebind": typeof lib_userRebind;
  "lib/userRoleHelpers": typeof lib_userRoleHelpers;
  "lib/validators": typeof lib_validators;
  "lib/webhookTimestamp": typeof lib_webhookTimestamp;
  notifications: typeof notifications;
  organizations: typeof organizations;
  parkedData: typeof parkedData;
  portalDraft: typeof portalDraft;
  portalSubmission: typeof portalSubmission;
  reconciliation: typeof reconciliation;
  reservationsMutations: typeof reservationsMutations;
  resourceQueries: typeof resourceQueries;
  seed: typeof seed;
  seedData: typeof seedData;
  seedExport: typeof seedExport;
  "shared/activityCatalog": typeof shared_activityCatalog;
  "shared/addressValidator": typeof shared_addressValidator;
  "shared/agencies": typeof shared_agencies;
  "shared/aowSelection": typeof shared_aowSelection;
  "shared/boatTypes": typeof shared_boatTypes;
  "shared/bookingExpiry": typeof shared_bookingExpiry;
  "shared/capabilityGate": typeof shared_capabilityGate;
  "shared/courseCodes": typeof shared_courseCodes;
  "shared/coverageValidation": typeof shared_coverageValidation;
  "shared/dateRange": typeof shared_dateRange;
  "shared/diopters": typeof shared_diopters;
  "shared/enumValidator": typeof shared_enumValidator;
  "shared/gasMixes": typeof shared_gasMixes;
  "shared/gearRequiredFields": typeof shared_gearRequiredFields;
  "shared/gearSizing": typeof shared_gearSizing;
  "shared/i18nConstants": typeof shared_i18nConstants;
  "shared/notificationLogistics": typeof shared_notificationLogistics;
  "shared/operatorTypes": typeof shared_operatorTypes;
  "shared/ratioRules": typeof shared_ratioRules;
  "shared/resourceOwnerTypes": typeof shared_resourceOwnerTypes;
  "shared/roleKinds": typeof shared_roleKinds;
  "shared/schemaEnums": typeof shared_schemaEnums;
  "shared/statuses": typeof shared_statuses;
  "shared/tcVersion": typeof shared_tcVersion;
  "shared/venueFeatures": typeof shared_venueFeatures;
  "shared/venueTypes": typeof shared_venueTypes;
  stakeholderPreferences: typeof stakeholderPreferences;
  support: typeof support;
  testHelpers: typeof testHelpers;
  themes: typeof themes;
  userRoles: typeof userRoles;
  users: typeof users;
  venues: typeof venues;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
