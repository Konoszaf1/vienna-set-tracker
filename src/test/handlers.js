import { http, HttpResponse } from "msw";
import fixture from "./fixtures/jobs.sample.json";
import historyFixture from "./fixtures/job-history.sample.json";

/**
 * Default MSW handlers for vitest.
 * Intercepts fetch("...jobs.json...") and returns the fixture payload.
 */
export const handlers = [
  http.get("*/jobs.json", () => {
    return HttpResponse.json(fixture);
  }),
  http.get("*/job-history.json", () => {
    return HttpResponse.json(historyFixture);
  }),
];
