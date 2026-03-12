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
import type * as devSwitcher from "../devSwitcher.js";
import type * as boats from "../boats.js";
import type * as bookingDraftMutations from "../bookingDraftMutations.js";
import type * as bookingLinks from "../bookingLinks.js";
import type * as bookings from "../bookings.js";
import type * as bookingsMutations from "../bookingsMutations.js";
import type * as compressors from "../compressors.js";
import type * as crons from "../crons.js";
import type * as customerProfiles from "../customerProfiles.js";
import type * as customers from "../customers.js";
import type * as directory from "../directory.js";
import type * as diveCenters from "../diveCenters.js";
import type * as diveMasters from "../diveMasters.js";
import type * as equipment from "../equipment.js";
import type * as instructors from "../instructors.js";
import type * as notifications from "../notifications.js";
import type * as pools from "../pools.js";
import type * as portalSubmission from "../portalSubmission.js";
import type * as reservationsMutations from "../reservationsMutations.js";
import type * as resourceQueries from "../resourceQueries.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";
import type * as seedInstructorData from "../seedInstructorData.js";
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
  devSwitcher: typeof devSwitcher;
  bookingDraftMutations: typeof bookingDraftMutations;
  bookingLinks: typeof bookingLinks;
  bookings: typeof bookings;
  bookingsMutations: typeof bookingsMutations;
  compressors: typeof compressors;
  crons: typeof crons;
  customerProfiles: typeof customerProfiles;
  customers: typeof customers;
  directory: typeof directory;
  diveCenters: typeof diveCenters;
  diveMasters: typeof diveMasters;
  equipment: typeof equipment;
  instructors: typeof instructors;
  notifications: typeof notifications;
  pools: typeof pools;
  portalSubmission: typeof portalSubmission;
  reservationsMutations: typeof reservationsMutations;
  resourceQueries: typeof resourceQueries;
  seed: typeof seed;
  seedData: typeof seedData;
  seedInstructorData: typeof seedInstructorData;
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
