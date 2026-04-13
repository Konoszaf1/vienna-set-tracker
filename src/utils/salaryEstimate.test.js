import { estimateSalary, BASELINE } from './salaryEstimate';

describe('estimateSalary', () => {
  it('exports BASELINE as 63', () => {
    expect(BASELINE).toBe(63);
  });

  describe('senior triggers (+8)', () => {
    it.each([
      'Senior SDET',
      'Sr. Test Engineer',
      'Sr Test Engineer',
      'Lead QA Engineer',
      'Staff Engineer',
      'Principal SDET',
      'Head of QA',
    ])('%s => 71', (title) => {
      expect(estimateSalary(title)).toBe(71);
    });
  });

  describe('junior triggers (-15)', () => {
    it.each([
      'Junior QA Engineer',
      'Jr. SDET',
      'Jr SDET',
      'Trainee System Test Engineer',
      'Intern Software Tester',
      'Praktikum Quality Assurance',
    ])('%s => 48', (title) => {
      expect(estimateSalary(title)).toBe(48);
    });
  });

  describe('case-insensitive matching', () => {
    it.each([
      ['SENIOR SDET', 71],
      ['senior sdet', 71],
      ['JUNIOR QA', 48],
    ])('%s => %i', (title, expected) => {
      expect(estimateSalary(title)).toBe(expected);
    });
  });

  describe('baseline (no signal)', () => {
    it.each([
      'Test Automation Engineer',
      'QA Engineer (m/w/d)',
      'Software Test Engineer',
    ])('%s => 63', (title) => {
      expect(estimateSalary(title)).toBe(63);
    });
  });

  describe('edge cases', () => {
    it('empty string returns 63', () => {
      expect(estimateSalary('')).toBe(63);
    });

    it('"Senior." returns 71 (word boundary after dot)', () => {
      expect(estimateSalary('Senior.')).toBe(71);
    });

    it('"Seniority Engineer" returns 63 (\\b prevents partial match)', () => {
      expect(estimateSalary('Seniority Engineer')).toBe(63);
    });
  });

  it('senior takes priority over junior', () => {
    expect(estimateSalary('Senior Junior SDET')).toBe(71);
  });
});
