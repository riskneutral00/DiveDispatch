/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as availability from "../availability.js";
import type * as boats from "../boats.js";
import type * as bookingAuditLog from "../bookingAuditLog.js";
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
import type * as bookings_stateMachine from "../bookings/stateMachine.js";
import type * as bookings_status from "../bookings/status.js";
import type * as compressors from "../compressors.js";
import type * as crons from "../crons.js";
import type * as customerProfiles from "../customerProfiles.js";
import type * as customers from "../customers.js";
import type * as demoBookings from "../demoBookings.js";
import type * as devSwitcher from "../devSwitcher.js";
import type * as directory from "../directory.js";
import type * as diveCenters from "../diveCenters.js";
import type * as diveMasters from "../diveMasters.js";
import type * as email from "../email.js";
import type * as equipment from "../equipment.js";
import type * as equipmentBags from "../equipmentBags.js";
import type * as equipmentWidget from "../equipmentWidget.js";
import type * as http from "../http.js";
import type * as instructors from "../instructors.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_devGuard from "../lib/devGuard.js";
import type * as lib_errorCodes from "../lib/errorCodes.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_portal from "../lib/portal.js";
import type * as lib_profileCompleteness from "../lib/profileCompleteness.js";
import type * as lib_profileHelpers from "../lib/profileHelpers.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as lib_requiredFields from "../lib/requiredFields.js";
import type * as lib_rolePrecedence from "../lib/rolePrecedence.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as lib_timeConstants from "../lib/timeConstants.js";
import type * as lib_typedDb from "../lib/typedDb.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_webhookTimestamp from "../lib/webhookTimestamp.js";
import type * as notifications from "../notifications.js";
import type * as portalDraft from "../portalDraft.js";
import type * as portalSubmission from "../portalSubmission.js";
import type * as reservationsMutations from "../reservationsMutations.js";
import type * as resourceQueries from "../resourceQueries.js";
import type * as seed from "../seed.js";
import type * as seedBookingData from "../seedBookingData.js";
import type * as seedData from "../seedData.js";
import type * as seedInstructorData from "../seedInstructorData.js";
import type * as shared_agencies from "../shared/agencies.js";
import type * as shared_aowSpecialties from "../shared/aowSpecialties.js";
import type * as shared_bookingExpiry from "../shared/bookingExpiry.js";
import type * as shared_courseCodes from "../shared/courseCodes.js";
import type * as shared_coverageValidation from "../shared/coverageValidation.js";
import type * as shared_dateRange from "../shared/dateRange.js";
import type * as shared_gearSizing from "../shared/gearSizing.js";
import type * as shared_resourceOwnerTypes from "../shared/resourceOwnerTypes.js";
import type * as shared_statuses from "../shared/statuses.js";
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
  agents: typeof agents;
  availability: typeof availability;
  boats: typeof boats;
  bookingAuditLog: typeof bookingAuditLog;
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
  "bookings/stateMachine": typeof bookings_stateMachine;
  "bookings/status": typeof bookings_status;
  compressors: typeof compressors;
  crons: typeof crons;
  customerProfiles: typeof customerProfiles;
  customers: typeof customers;
  demoBookings: typeof demoBookings;
  devSwitcher: typeof devSwitcher;
  directory: typeof directory;
  diveCenters: typeof diveCenters;
  diveMasters: typeof diveMasters;
  email: typeof email;
  equipment: typeof equipment;
  equipmentBags: typeof equipmentBags;
  equipmentWidget: typeof equipmentWidget;
  http: typeof http;
  instructors: typeof instructors;
  "lib/alerts": typeof lib_alerts;
  "lib/auth": typeof lib_auth;
  "lib/devGuard": typeof lib_devGuard;
  "lib/errorCodes": typeof lib_errorCodes;
  "lib/idempotency": typeof lib_idempotency;
  "lib/logger": typeof lib_logger;
  "lib/portal": typeof lib_portal;
  "lib/profileCompleteness": typeof lib_profileCompleteness;
  "lib/profileHelpers": typeof lib_profileHelpers;
  "lib/rateLimiter": typeof lib_rateLimiter;
  "lib/requiredFields": typeof lib_requiredFields;
  "lib/rolePrecedence": typeof lib_rolePrecedence;
  "lib/sanitize": typeof lib_sanitize;
  "lib/timeConstants": typeof lib_timeConstants;
  "lib/typedDb": typeof lib_typedDb;
  "lib/types": typeof lib_types;
  "lib/validate": typeof lib_validate;
  "lib/validators": typeof lib_validators;
  "lib/webhookTimestamp": typeof lib_webhookTimestamp;
  notifications: typeof notifications;
  portalDraft: typeof portalDraft;
  portalSubmission: typeof portalSubmission;
  reservationsMutations: typeof reservationsMutations;
  resourceQueries: typeof resourceQueries;
  seed: typeof seed;
  seedBookingData: typeof seedBookingData;
  seedData: typeof seedData;
  seedInstructorData: typeof seedInstructorData;
  "shared/agencies": typeof shared_agencies;
  "shared/aowSpecialties": typeof shared_aowSpecialties;
  "shared/bookingExpiry": typeof shared_bookingExpiry;
  "shared/courseCodes": typeof shared_courseCodes;
  "shared/coverageValidation": typeof shared_coverageValidation;
  "shared/dateRange": typeof shared_dateRange;
  "shared/gearSizing": typeof shared_gearSizing;
  "shared/resourceOwnerTypes": typeof shared_resourceOwnerTypes;
  "shared/statuses": typeof shared_statuses;
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
