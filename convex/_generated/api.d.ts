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
import type * as bookingDraftMutations from "../bookingDraftMutations.js";
import type * as bookingLinks from "../bookingLinks.js";
import type * as bookingTemplates from "../bookingTemplates.js";
import type * as bookings from "../bookings.js";
import type * as bookings__shared from "../bookings/_shared.js";
import type * as bookings_create from "../bookings/create.js";
import type * as bookings_edit from "../bookings/edit.js";
import type * as bookings_status from "../bookings/status.js";
import type * as bookingsMutations from "../bookingsMutations.js";
import type * as compressors from "../compressors.js";
import type * as crons from "../crons.js";
import type * as customerProfiles from "../customerProfiles.js";
import type * as customers from "../customers.js";
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
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_portal from "../lib/portal.js";
import type * as lib_validate from "../lib/validate.js";
import type * as notifications from "../notifications.js";
import type * as pools from "../pools.js";
import type * as portalDraft from "../portalDraft.js";
import type * as portalSubmission from "../portalSubmission.js";
import type * as reservationsMutations from "../reservationsMutations.js";
import type * as resourceQueries from "../resourceQueries.js";
import type * as seed from "../seed.js";
import type * as seedBookingData from "../seedBookingData.js";
import type * as seedData from "../seedData.js";
import type * as seedInstructorData from "../seedInstructorData.js";
import type * as stakeholderHierarchy from "../stakeholderHierarchy.js";
import type * as stakeholderPreferences from "../stakeholderPreferences.js";
import type * as support from "../support.js";
import type * as themes from "../themes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  availability: typeof availability;
  boats: typeof boats;
  bookingDraftMutations: typeof bookingDraftMutations;
  bookingLinks: typeof bookingLinks;
  bookingTemplates: typeof bookingTemplates;
  bookings: typeof bookings;
  "bookings/_shared": typeof bookings__shared;
  "bookings/create": typeof bookings_create;
  "bookings/edit": typeof bookings_edit;
  "bookings/status": typeof bookings_status;
  bookingsMutations: typeof bookingsMutations;
  compressors: typeof compressors;
  crons: typeof crons;
  customerProfiles: typeof customerProfiles;
  customers: typeof customers;
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
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/portal": typeof lib_portal;
  "lib/validate": typeof lib_validate;
  notifications: typeof notifications;
  pools: typeof pools;
  portalDraft: typeof portalDraft;
  portalSubmission: typeof portalSubmission;
  reservationsMutations: typeof reservationsMutations;
  resourceQueries: typeof resourceQueries;
  seed: typeof seed;
  seedBookingData: typeof seedBookingData;
  seedData: typeof seedData;
  seedInstructorData: typeof seedInstructorData;
  stakeholderHierarchy: typeof stakeholderHierarchy;
  stakeholderPreferences: typeof stakeholderPreferences;
  support: typeof support;
  themes: typeof themes;
  users: typeof users;
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
