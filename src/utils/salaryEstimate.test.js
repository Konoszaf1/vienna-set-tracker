import { estimateSalary, BASELINE } from './salaryEstimate';

describe('estimateSalary', () => {
  it('exports BASELINE as 63', () => {
    expect(BASELINE).toBe(63);
  });

  describe('LEGACY BACKWARD COMPATIBILITY (title string only)', () => {
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

  describe('NEW MULTI-FACTOR HEURISTICS', () => {
    describe('Seniority Base Scales (with basic techStack/lang to trigger)', () => {
      it('Lead / Architect / Principal / Head / Staff Base => 80', () => {
        const role = { title: 'Lead Test Automation Engineer', techStack: [], langReq: 'de-basic' };
        expect(estimateSalary(role)).toBe(80);
      });

      it('Senior / Sr. / Specialist / Expert Base => 71', () => {
        const role = { title: 'Senior SDET', techStack: [], langReq: 'de-basic' };
        expect(estimateSalary(role)).toBe(71);
      });

      it('Mid / Regular / Default Base => 62', () => {
        const role = { title: 'Test Automation Engineer', techStack: [], langReq: 'de-basic' };
        expect(estimateSalary(role)).toBe(62);
      });

      it('Junior / Jr. / Graduate Base => 46', () => {
        const role = { title: 'Junior QA Engineer', techStack: [], langReq: 'de-basic' };
        expect(estimateSalary(role)).toBe(46);
      });

      it('Intern / Trainee / Praktikum / Student Base => 32', () => {
        const role = { title: 'Intern Software Tester', techStack: [], langReq: 'de-basic' };
        expect(estimateSalary(role)).toBe(32);
      });
    });

    describe('Tech Stack Premiums & Discounts', () => {
      it('adds +2k per premium developer-grade technology (max +8k)', () => {
        // Java (+2k) + Docker (+2k) = +4k on top of Mid (62) => 66
        const role = { title: 'SDET', techStack: ['Java', 'Docker'], langReq: 'de-basic' };
        expect(estimateSalary(role)).toBe(66);
      });

      it('caps tech stack premium at +8k', () => {
        // Java, Python, Rust, Go, AWS, Docker, Kubernetes (+14k theoretically, capped at +8k) => 62 + 8 = 70
        const role = {
          title: 'SDET',
          techStack: ['Java', 'Python', 'Rust', 'Go', 'AWS', 'Docker', 'Kubernetes'],
          langReq: 'de-basic'
        };
        expect(estimateSalary(role)).toBe(70);
      });

      it('applies manual testing discount (-6k) for manual tags with zero automation', () => {
        // Manual Testing + Jira + Excel => -6k on top of Mid (62) => 56
        const role = {
          title: 'QA Engineer',
          techStack: ['Manual Testing', 'Jira', 'Excel'],
          langReq: 'de-basic'
        };
        expect(estimateSalary(role)).toBe(56);
      });

      it('prevents manual discount if any code/automation signal is present', () => {
        // Manual Testing + Jira + Selenium (Automation signal) => no discount, Selenium is not premium, so 62
        const role = {
          title: 'QA Engineer',
          techStack: ['Manual Testing', 'Jira', 'Selenium'],
          langReq: 'de-basic'
        };
        expect(estimateSalary(role)).toBe(62);
      });
    });

    describe('Language Requirements', () => {
      it('adds +3k for English-accessible (en) roles', () => {
        const role = { title: 'SDET', techStack: [], langReq: 'en' };
        expect(estimateSalary(role)).toBe(65); // 62 + 3 = 65
      });

      it('subtracts -2k for Fluent German (de-fluent) roles', () => {
        const role = { title: 'SDET', techStack: [], langReq: 'de-fluent' };
        expect(estimateSalary(role)).toBe(60); // 62 - 2 = 60
      });

      it('adds nothing (0k) for de-basic roles', () => {
        const role = { title: 'SDET', techStack: [], langReq: 'de-basic' };
        expect(estimateSalary(role)).toBe(62); // 62
      });
    });

    describe('Company Reputation Scores (kununuScore)', () => {
      it('adds +4k for rating >= 4.5', () => {
        const role = { title: 'SDET', techStack: [], langReq: 'de-basic', kununuScore: 4.6 };
        expect(estimateSalary(role)).toBe(66); // 62 + 4 = 66
      });

      it('adds +2k for rating >= 4.0', () => {
        const role = { title: 'SDET', techStack: [], langReq: 'de-basic', kununuScore: 4.2 };
        expect(estimateSalary(role)).toBe(64); // 62 + 2 = 64
      });

      it('subtracts -3k for rating < 3.0', () => {
        const role = { title: 'SDET', techStack: [], langReq: 'de-basic', kununuScore: 2.8 };
        expect(estimateSalary(role)).toBe(59); // 62 - 3 = 59
      });
    });

    describe('Low-Gravity Blending & Clamping', () => {
      it('blends reported salaries as a 30% weight anchor', () => {
        // Heuristic: Senior (71) + Java (+2k) + en (+3k) + kununu (4.5 rating => +4k) = 80
        // Reported: 95
        // Estimate: 0.7 * 80 + 0.3 * 95 = 56 + 28.5 = 84.5 => rounds to 85
        const role = {
          title: 'Senior SDET',
          techStack: ['Java'],
          langReq: 'en',
          kununuScore: 4.5,
          reportedSalary: 95
        };
        expect(estimateSalary(role)).toBe(85);
      });

      it('clamps estimates to the minimum floor of 24k', () => {
        // Intern (32) + manual (-6k) + de-fluent (-2k) + low kununu (-3k) = 21k (clamped to 24k)
        const role = {
          title: 'Intern',
          techStack: ['Manual Testing'],
          langReq: 'de-fluent',
          kununuScore: 2.5
        };
        expect(estimateSalary(role)).toBe(24);
      });

      it('clamps estimates to the maximum ceiling of 115k', () => {
        // Lead (80) + full tech (+8k) + en (+3k) + kununu (+4) = 95
        // Reported: 180
        // Estimate: 0.7 * 95 + 0.3 * 180 = 66.5 + 54 = 120.5 (clamped to 115k)
        const role = {
          title: 'Lead Architect',
          techStack: ['Java', 'Docker', 'AWS', 'Kubernetes'],
          langReq: 'en',
          kununuScore: 4.8,
          reportedSalary: 180
        };
        expect(estimateSalary(role)).toBe(115);
      });
    });
  });
});

