import { memo } from "react";
import StarRating from "./StarRating";
import Badge from "./Badge";
import { formatListingAge, listingDate } from "../utils/listingRecency";
import styles from './CompanyCard.module.css';

const CompanyCard = memo(function CompanyCard({ company, salary, feedHealth }) {
  const primaryJobUrl = company.openRoles?.[0]?.url || company.jobUrl;
  const roles = company.openRoles || [];
  const verificationStatuses = roles.map(role => role.verificationStatus).filter(Boolean);
  const allAlive = verificationStatuses.length > 0 && verificationStatuses.every(status => status === "alive");
  const hasProbation = verificationStatuses.some(status => status === "probation");
  const listingLabel = feedHealth?.stale
    ? "Stale — verify before applying"
    : hasProbation
      ? "Verification pending"
      : allAlive
        ? "Verified listing"
        : "Recently discovered";
  const newestRole = roles.reduce((newest, role) => {
    if (!newest) return role;
    return String(listingDate(role).timestamp || "") > String(listingDate(newest).timestamp || "") ? role : newest;
  }, null);
  const bestRange = salary?.bestRange;

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
        {newestRole && listingDate(newestRole).timestamp && (
          <div className={styles.firstSeen}>
            {formatListingAge(newestRole)}
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

      {bestRange && (
        <div className={styles.salaryBox}>
          <div>
            <div className={styles.salaryLabel}>{bestRange.label}</div>
            <div className={styles.salaryConfidence}>{bestRange.confidence} confidence · gross/year</div>
          </div>
          <span
            title={`${bestRange.label}; ${bestRange.reasons.join(", ")}`}
            className={styles.salaryAmount}
            data-tier={bestRange.target >= 70 ? "high" : bestRange.target >= 60 ? "midhi" : bestRange.target >= 55 ? "mid" : "low"}
          >
            €{bestRange.min}–{bestRange.max}k
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
                <span className={styles.roleMetadata}>
                  {role.source && <span className={styles.roleSource}>{role.source}</span>}
                  <span className={styles.roleDate}>{formatListingAge(role)}</span>
                </span>
              </span>
              {salary?.roles?.[i] && (
                <span
                  className={styles.roleEstimate}
                  title={`${salary.roles[i].label}; target €${salary.roles[i].target}k`}
                >
                  €{salary.roles[i].min}–{salary.roles[i].max}k
                </span>
              )}
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
