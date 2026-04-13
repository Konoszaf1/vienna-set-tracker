import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import { readFileSync } from "fs";

const schema = {
  type: "object",
  required: ["jobs", "count"],
  properties: {
    lastUpdated: { type: "string" },
    count: { type: "integer", minimum: 0 },
    lastVerified: { type: "string" },
    jobs: {
      type: "array",
      items: {
        type: "object",
        required: ["url", "title", "company"],
        properties: {
          url: { type: "string", pattern: "^https?://" },
          title: { type: "string", minLength: 1 },
          company: { type: "string", minLength: 1 },
          source: { type: "string" },
          address: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          zip: { type: ["string", "null"] },
          lat: { type: ["number", "null"] },
          lng: { type: ["number", "null"] },
          langReq: { type: "string" },
          techStack: { type: "array", items: { type: "string" } },
          kununuScore: { type: ["number", "null"] },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
};

describe("jobs.json schema contract", () => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  it("public/jobs.json matches the contract schema", () => {
    const raw = readFileSync("public/jobs.json", "utf-8");
    const data = JSON.parse(raw);
    const valid = validate(data);
    if (!valid) {
      console.error("Schema errors:", validate.errors);
    }
    expect(valid).toBe(true);
  });

  it("count matches jobs array length", () => {
    const data = JSON.parse(readFileSync("public/jobs.json", "utf-8"));
    expect(data.count).toBe(data.jobs.length);
  });

  it("every job has a valid https URL", () => {
    const data = JSON.parse(readFileSync("public/jobs.json", "utf-8"));
    for (const job of data.jobs) {
      expect(job.url).toMatch(/^https:\/\//);
    }
  });

  it("no job has an empty title or company", () => {
    const data = JSON.parse(readFileSync("public/jobs.json", "utf-8"));
    for (const job of data.jobs) {
      expect(job.title.trim().length).toBeGreaterThan(0);
      expect(job.company.trim().length).toBeGreaterThan(0);
    }
  });

  it("fixture file also matches the schema", () => {
    const raw = readFileSync("src/test/fixtures/jobs.sample.json", "utf-8");
    const data = JSON.parse(raw);
    const valid = validate(data);
    if (!valid) {
      console.error("Schema errors:", validate.errors);
    }
    expect(valid).toBe(true);
  });
});
