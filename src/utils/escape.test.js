import { describe, it, expect } from 'vitest';
import { escapeHtml, isSafeUrl } from './escape';

describe("escapeHtml", () => {
  it("escapes &, <, >, \", and '", () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it("escapes XSS payload", () => {
    const input = '<img src=x onerror=alert(1)>';
    const output = escapeHtml(input);
    expect(output).toContain('&lt;');
    expect(output).toContain('&gt;');
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
  });

  it("handles null, undefined, and numbers without crashing", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(0)).toBe("0");
  });

  it("passes through safe strings unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("isSafeUrl", () => {
  it("returns true for http://", () => {
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("returns true for https://", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSafeUrl("HTTPS://example.com")).toBe(true);
    expect(isSafeUrl("Http://example.com")).toBe(true);
  });

  it("returns false for javascript:", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("returns false for data:", () => {
    expect(isSafeUrl("data:text/html,<h1>Hi</h1>")).toBe(false);
  });

  it("returns false for file:", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSafeUrl("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSafeUrl(null)).toBe(false);
  });

  it("returns false for relative paths", () => {
    expect(isSafeUrl("/path/to/page")).toBe(false);
    expect(isSafeUrl("../page")).toBe(false);
  });
});
