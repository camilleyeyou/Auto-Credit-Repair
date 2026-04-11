/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bureauResponses from "../bureauResponses.js";
import type * as cfpbComplaints from "../cfpbComplaints.js";
import type * as cfpbPipeline from "../cfpbPipeline.js";
import type * as cfpbReferenceComplaints from "../cfpbReferenceComplaints.js";
import type * as creditReports from "../creditReports.js";
import type * as crons from "../crons.js";
import type * as disputeItems from "../disputeItems.js";
import type * as http from "../http.js";
import type * as letters from "../letters.js";
import type * as notifications from "../notifications.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bureauResponses: typeof bureauResponses;
  cfpbComplaints: typeof cfpbComplaints;
  cfpbPipeline: typeof cfpbPipeline;
  cfpbReferenceComplaints: typeof cfpbReferenceComplaints;
  creditReports: typeof creditReports;
  crons: typeof crons;
  disputeItems: typeof disputeItems;
  http: typeof http;
  letters: typeof letters;
  notifications: typeof notifications;
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
