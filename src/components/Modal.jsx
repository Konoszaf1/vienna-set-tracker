import styles from './Modal.module.css';

export default function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div onClick={onClose} className={styles.overlay}>
      <div onClick={e => e.stopPropagation()} className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button onClick={onClose} className={styles.closeButton}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
