import { memo } from "react";
import StarRating from "./StarRating";
import Badge from "./Badge";
import styles from './CompanyCard.module.css';

const CompanyCard = memo(function CompanyCard({ company, salary }) {
  const primaryJobUrl = company.openRoles?.[0]?.url || company.jobUrl;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.companyInfo}>
          <span className={styles.logo}>{company.logo}</span>
          <div>
            <h3 className={styles.name}>{company.name}</h3>
          </div>
        </div>
        <Badge color="#06b6d4" bg="#06b6d420">Live listing</Badge>
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
              const diffDays = Math.floor((now - d) / 86400000);
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
          <div className={styles.salaryLabel}>Est. Salary</div>
          <span className={styles.salaryAmount} data-tier={salary.best >= 65 ? "high" : salary.best >= 58 ? "mid" : "low"}>
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
          ? <Badge color="#ef4444" bg="#ef444420">Fluent German Required</Badge>
          : <Badge color="#10b981" bg="#10b98120">{company.langReq === "en" ? "English Only" : "No Fluent German Needed"}</Badge>
        }
      </div>

      {company.openRoles?.length > 0 && (
        <div className={styles.rolesSection}>
          <div className={styles.sectionLabel}>Open roles ({company.openRoles.length})</div>
          {company.openRoles.map((role, i) => (
            <a key={i} href={role.url} target="_blank" rel="noopener noreferrer" className={styles.roleLink}>
              {role.title}
              {salary?.roles?.[i] && (
                <span className={styles.roleEstimate}>€{salary.roles[i].estimate}k</span>
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
