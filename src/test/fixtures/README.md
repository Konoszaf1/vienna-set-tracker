# Test Fixtures

## jobs.sample.json

Hand-crafted representative payload used by both vitest (via MSW) and Playwright (via `page.route`). The real scraped `public/jobs.json` is never loaded during tests.

### Shape

```json
{
  "count": 10,
  "lastUpdated": "ISO string",
  "jobs": [{ "title", "company", "url", "city", "address?", "lat?", "lng?", "langReq", "techStack", "kununuScore?", "source" }]
}
```

### What it covers

| Scenario | Companies |
|---|---|
| English-only roles | Dynatrace, XSS Corp, Stealth Startup, CoolPeople |
| Fluent German required | Wiener Stadtwerke, PKE Holding |
| Basic German | RINGANA, ÖBB |
| Has kununu rating | Dynatrace (4.2), RINGANA (3.5), ÖBB (3.8), PKE (4.0), CoolPeople (3.2) |
| No rating | Wiener Stadtwerke, XSS Corp, Stealth Startup |
| No coordinates | Stealth Startup |
| No tech stack | Stealth Startup |
| XSS payload in company name | `<img src=x onerror=alert(1)>` |
| Collapse via normalizeCompanyName | ÖBB-Konzern + ÖBB → 1 company |
| Multiple roles per company | RINGANA (2 roles) |
| Senior seniority (→ €71k) | Dynatrace, PKE |
| Junior seniority (→ €48k) | CoolPeople |
| Mid-level (→ €63k) | all others |

**10 jobs → 8 companies** after normalization.

### How to update

1. Edit `jobs.sample.json` — keep the mix of scenarios above.
2. Update this table if you add a new scenario.
3. Run `npm test` and `npm run e2e` to verify nothing broke.
4. Avoid adding more than ~15 jobs — the fixture should stay small and readable.
