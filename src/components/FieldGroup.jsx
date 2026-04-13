import styles from './FieldGroup.module.css';

export default function FieldGroup({ label, children }) {
  return (
    <label className={styles.group}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
