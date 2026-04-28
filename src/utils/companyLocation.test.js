import { describe, it, expect } from "vitest";
import { resolveCompanyLocation, isGenericViennaCoord } from "./companyLocation";

describe("isGenericViennaCoord", () => {
  it("treats null as generic", () => {
    expect(isGenericViennaCoord(null, null)).toBe(true);
    expect(isGenericViennaCoord(48.2, null)).toBe(true);
  });
  it("flags known Vienna centroids", () => {
    expect(isGenericViennaCoord(48.1857192, 16.4221587)).toBe(true);
    expect(isGenericViennaCoord(48.1822872, 16.3923295)).toBe(true);
  });
  it("accepts specific addresses", () => {
    expect(isGenericViennaCoord(48.2006384, 16.4268953)).toBe(false);
  });
});

describe("resolveCompanyLocation", () => {
  it("returns null coords when nothing is known", () => {
    const out = resolveCompanyLocation(
      [{ company: "Foo GmbH", lat: null, lng: null }],
      {}, {}
    );
    expect(out.lat).toBeNull();
    expect(out.lng).toBeNull();
    expect(out.source).toBe("unresolved");
  });

  it("prefers manual override over cache and roles", () => {
    const roles = [{ company: "Acme GmbH", lat: 48.20, lng: 16.40, address: "RoleStreet" }];
    const cache = { "acme gmbh": { lat: 48.21, lng: 16.41, address: "CacheStreet" } };
    const manual = { "acme gmbh": { lat: 48.22, lng: 16.42, address: "ManualStreet" } };
    const out = resolveCompanyLocation(roles, cache, manual);
    expect(out.lat).toBe(48.22);
    expect(out.address).toBe("ManualStreet");
    expect(out.source).toBe("manual");
  });

  it("uses cache when role coords are absent", () => {
    const roles = [{ company: "Beta AG", lat: null, lng: null }];
    const cache = { "beta ag": { lat: 48.25, lng: 16.36, address: "CacheStreet" } };
    const out = resolveCompanyLocation(roles, cache, {});
    expect(out.lat).toBe(48.25);
    expect(out.source).toBe("cache");
  });

  it("ignores cache hit with null lat", () => {
    const roles = [{ company: "Gamma", lat: 48.20, lng: 16.40, address: "RoleStreet" }];
    const cache = { gamma: { lat: null, lng: null, address: null } };
    const out = resolveCompanyLocation(roles, cache, {});
    expect(out.lat).toBe(48.20);
    expect(out.source).toBe("role-specific");
  });

  it("prefers a specific role coord over a generic role coord", () => {
    const roles = [
      { company: "Delta", lat: 48.1857192, lng: 16.4221587, address: "Vienna" }, // generic
      { company: "Delta", lat: 48.2006384, lng: 16.4268953, address: "Real St." }, // specific
    ];
    const out = resolveCompanyLocation(roles, {}, {});
    expect(out.lat).toBe(48.2006384);
    expect(out.address).toBe("Real St.");
    expect(out.source).toBe("role-specific");
  });

  it("falls back to a generic role coord when nothing better exists", () => {
    const roles = [
      { company: "Epsilon", lat: 48.1857192, lng: 16.4221587, address: "Vienna" },
    ];
    const out = resolveCompanyLocation(roles, {}, {});
    expect(out.lat).toBe(48.1857192);
    expect(out.source).toBe("role-generic");
  });

  it("matches case-insensitively against cache keys", () => {
    const roles = [{ company: "ÖBB-Konzern", lat: null, lng: null }];
    const cache = { "öbb-konzern": { lat: 48.20, lng: 16.40, address: "Wien Hbf" } };
    const out = resolveCompanyLocation(roles, cache, {});
    expect(out.lat).toBe(48.20);
  });

  it("tries every distinct role.company string when looking up the cache", () => {
    const roles = [
      { company: "Acme", lat: null, lng: null },
      { company: "Acme GmbH", lat: null, lng: null },
    ];
    const cache = { "acme gmbh": { lat: 48.20, lng: 16.40, address: "Office" } };
    const out = resolveCompanyLocation(roles, cache, {});
    expect(out.lat).toBe(48.20);
  });

  it("survives undefined cache and overrides", () => {
    const roles = [{ company: "Solo", lat: 48.20, lng: 16.40, address: "Here" }];
    const out = resolveCompanyLocation(roles, undefined, undefined);
    expect(out.lat).toBe(48.20);
    expect(out.source).toBe("role-specific");
  });
});
