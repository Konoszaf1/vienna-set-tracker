import styles from './FieldGroup.module.css';

export default function FieldGroup({ label, children }) {
  return (
    <div className={styles.group}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}
