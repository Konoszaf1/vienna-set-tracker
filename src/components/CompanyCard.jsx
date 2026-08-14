import { memo } from "react";
import StarRating from "./StarRating";
import Badge from "./Badge";
import styles from './CompanyCard.module.css';

const CompanyCard = memo(function CompanyCard({ company, salary, feedHealth }) {
  const primaryJobUrl = company.openRoles?.[0]?.url || company.jobUrl;
  const listingLabel = feedHealth?.stale
    ? "Stale — verify before applying"
    : feedHealth?.partial
      ? "Partially verified"
      : "Verified listing";

  return (
    <div className={styles.card} data-testid="company-card">
      <div className={styles.cardHeader}>
        <div className={styles.companyInfo}>
          <span className={styles.logo}>{company.logo}</span>
          <div>
            <h3 className={styles.name}>{company.name}</h3>
          </div>
        </div>
        <Badge
          color={feedHealth?.stale ? "#f59e0b" : "#06b6d4"}
          bg={feedHealth?.stale ? "#f59e0b20" : "#06b6d420"}
        >
          {listingLabel}
        </Badge>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.district}>
          <span>📍</span> {company.district}
        </div>
        {company.firstSeen && (
          <div className={styles.firstSeen}>
            {(() => {
              const d = new Date(company.firstSeen);
              const now = new Date();
              const diffDays = Math.max(0, Math.floor((now - d) / 86400000));
              const label = diffDays === 0 ? "Today" : diffDays === 1 ? "1 day ago" : `${diffDays}d ago`;
              return `Added ${label}`;
            })()}
          </div>
        )}
      </div>

      {company.kununuRating != null && (
        <div className={styles.ratingsRow}>
          <div>
            <div className={styles.ratingLabel}>Kununu</div>
            <StarRating rating={company.kununuRating} size={12} />
          </div>
        </div>
      )}

      {salary?.best != null && (
        <div className={styles.salaryBox}>
          <div className={styles.salaryLabel}>Heuristic estimate</div>
          <span title="Model estimate, not an advertised salary" className={styles.salaryAmount} data-tier={salary.best >= 70 ? "high" : salary.best >= 60 ? "midhi" : salary.best >= 55 ? "mid" : "low"}>
            €{salary.best}k
          </span>
        </div>
      )}

      {company.techStack.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>Tech Stack</div>
          <div className={styles.tagRow}>
            {company.techStack.slice(0, 5).map((t, i) => (
              <Badge key={i} color="#10b981" bg="#10b98115">{t}</Badge>
            ))}
            {company.techStack.length > 5 && <Badge color="#71717a" bg="#27272a">+{company.techStack.length - 5}</Badge>}
          </div>
        </div>
      )}

      <div className={styles.langReqRow}>
        <span className={styles.langIcon}>🗣</span>
        {company.langReq === "de-fluent"
          ? <Badge color="#f87171" bg="#ef444420">Fluent German Required</Badge>
          : company.langReq === "unknown"
            ? <Badge color="#a1a1aa" bg="#71717a20">Language not stated</Badge>
            : <Badge color="#10b981" bg="#10b98120">{company.langReq === "en" ? "English Only" : "No Fluent German Needed"}</Badge>
        }
      </div>

      {company.openRoles?.length > 0 && (
        <div className={styles.rolesSection}>
          <div className={styles.sectionLabel}>
            {company.matchingRoleCount != null && company.matchingRoleCount !== company.totalRoleCount
              ? `Matching roles (${company.matchingRoleCount} of ${company.totalRoleCount})`
              : `Open roles (${company.openRoles.length})`}
          </div>
          {company.openRoles.map((role, i) => (
            <a key={i} href={role.url} target="_blank" rel="noopener noreferrer" className={styles.roleLink}>
              <span className={styles.roleDetails}>
                <span>{role.title}</span>
                {role.source && <span className={styles.roleSource}>{role.source}</span>}
              </span>
              {salary?.roles?.[i] && <span className={styles.roleEstimate}>€{salary.roles[i].estimate}k</span>}
            </a>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        {primaryJobUrl && (
          <a href={primaryJobUrl} target="_blank" rel="noopener noreferrer" className={styles.viewJobLink}>
            View listing ↗
          </a>
        )}
      </div>
    </div>
  );
});

export default CompanyCard;
