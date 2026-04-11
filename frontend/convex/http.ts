import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpIngest } from "./cfpbReferenceComplaints";

const http = httpRouter();

auth.addHttpRoutes(http);

// CFPB reference data bulk ingest endpoint (used by backend/scripts/cfpb_pipeline.py)
http.route({
  path: "/api/cfpb-ingest",
  method: "POST",
  handler: httpIngest,
});

export default http;
