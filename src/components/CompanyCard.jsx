import { memo, useState } from "react";
import { STATUS_OPTIONS } from "../constants";
import StarRating from "./StarRating";
import Badge from "./Badge";
import styles from './CompanyCard.module.css';

const CompanyCard = memo(function CompanyCard({ company, onEdit, onDelete, insights }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_OPTIONS.find(s => s.value === company.status) || STATUS_OPTIONS[0];
  const avgRating = [company.kununuRating, company.glassdoorRating].filter(r => r !== null && r !== undefined);
  const avg = avgRating.length ? (avgRating.reduce((a, b) => a + b, 0) / avgRating.length) : null;

  const salary = insights?.salary;
  const match = insights?.match;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.companyInfo}>
          <span className={styles.logo}>{company.logo}</span>
          <div>
            <h3 className={styles.name}>{company.name}</h3>
            <span className={styles.industry}>{company.industry}</span>
          </div>
        </div>
        <Badge color={status.color} bg={status.bg}>{status.label}</Badge>
      </div>

      <div className={styles.district}>
        <span>📍</span> {company.district}
      </div>

      <div className={styles.ratingsRow}>
        <div>
          <div className={styles.ratingLabel}>Kununu</div>
          <StarRating rating={company.kununuRating} size={12} />
        </div>
        <div>
          <div className={styles.ratingLabel}>Glassdoor</div>
          <StarRating rating={company.glassdoorRating} size={12} />
        </div>
        {avg !== null && (
          <div>
            <div className={styles.ratingLabel}>Average</div>
            <span className={styles.avgRating} data-tier={avg >= 4 ? "high" : avg >= 3.5 ? "mid" : "low"}>
              {avg.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {salary ? (
        <div className={styles.modelBox}>
          <button
            className={styles.modelToggle}
            onClick={() => setExpanded(prev => !prev)}
            title="Show salary model breakdown"
          >
            <span className={styles.modelHeader}>
              <span className={styles.modelLabel}>Expected Salary</span>
              <span className={styles.modelValue} data-tier={salary.estimate >= 65 ? "high" : salary.estimate >= 58 ? "mid" : "low"}>
                €{salary.estimate}k
              </span>
              {salary.isOverridden && (
                <span className={styles.overrideBadge}>override</span>
              )}
              {match && (
                <span className={styles.matchBadge} data-grade={match.grade.toLowerCase()}>
                  {match.score}% match
                </span>
              )}
            </span>
            <span className={styles.expandIcon}>{expanded ? "▾" : "▸"}</span>
          </button>

          {expanded && (
            <div className={styles.breakdownPanel}>
              <div className={styles.breakdownSection}>
                <div className={styles.breakdownTitle}>Salary Breakdown</div>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownName}>Baseline</span>
                  <span className={styles.breakdownDelta}>€{salary.baseline}k</span>
                </div>
                {salary.allAdjustments.map((a, i) => (
                  <div key={i} className={styles.breakdownRow} title={a.reason}>
                    <span className={styles.breakdownName}>{a.name}</span>
                    <span className={styles.breakdownDelta} data-sign={a.delta > 0 ? "pos" : a.delta < 0 ? "neg" : "zero"}>
                      {a.delta > 0 ? "+" : ""}{a.delta}k
                    </span>
                  </div>
                ))}
                {salary.clamped && (
                  <div className={styles.breakdownNote}>Clamped to range</div>
                )}
                {salary.isOverridden && (
                  <div className={styles.breakdownOverride}>
                    Override: {salary.authorOverride.reason}
                  </div>
                )}
              </div>

              {match && (
                <div className={styles.breakdownSection}>
                  <div className={styles.breakdownTitle}>Match Factors</div>
                  {match.factors.map((f, i) => (
                    <div key={i} className={styles.breakdownRow} title={f.reason}>
                      <span className={styles.breakdownName}>{f.name}</span>
                      <span className={styles.matchBar}>
                        <span
                          className={styles.matchBarFill}
                          style={{ width: `${f.score}%` }}
                          data-level={f.score >= 70 ? "high" : f.score >= 40 ? "mid" : "low"}
                        />
                      </span>
                      <span className={styles.matchPercent}>{f.score}</span>
                    </div>
                  ))}
                  {match.topStrengths.length > 0 && (
                    <div className={styles.breakdownHighlight} data-type="strength">
                      {match.topStrengths[0]}
                    </div>
                  )}
                  {match.topConcerns.length > 0 && (
                    <div className={styles.breakdownHighlight} data-type="concern">
                      {match.topConcerns[0]}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.salaryBox}>
          <div className={styles.salaryLabel}>Expected Salary</div>
          <span className={styles.salaryAmount} style={{ color: '#52525b' }}>—</span>
        </div>
      )}

      <div>
        <div className={styles.sectionLabel}>Tech Stack</div>
        <div className={styles.tagRow}>
          {company.techStack.slice(0, 5).map((t, i) => (
            <Badge key={i} color="#10b981" bg="#10b98115">{t}</Badge>
          ))}
          {company.techStack.length > 5 && <Badge color="#71717a" bg="#27272a">+{company.techStack.length - 5}</Badge>}
        </div>
      </div>

      <div className={styles.tagRow}>
        {company.cultureTags.map((t, i) => (
          <Badge key={i} color="#8b5cf6" bg="#8b5cf615">{t}</Badge>
        ))}
      </div>

      <div className={styles.langReqRow}>
        <span className={styles.langIcon}>🗣</span>
        {company.langReq === "de-fluent"
          ? <Badge color="#ef4444" bg="#ef444420">Fluent German Required</Badge>
          : <Badge color="#10b981" bg="#10b98120">{company.langReq === "en" ? "English Only" : "No Fluent German Needed"}</Badge>
        }
      </div>

      {company.notes && (
        <div className={styles.notesBox}>
          <p className={styles.notesText}>{company.notes}</p>
        </div>
      )}

      <div className={styles.actions}>
        {company.jobUrl && (
          <a href={company.jobUrl} target="_blank" rel="noopener noreferrer" className={styles.viewJobLink}>
            View Job ↗
          </a>
        )}
        <button onClick={() => onEdit(company)} className={styles.editButton}>Edit</button>
        <button onClick={() => onDelete(company.id)} className={styles.deleteButton}>✕</button>
      </div>
    </div>
  );
});

export default CompanyCard;
