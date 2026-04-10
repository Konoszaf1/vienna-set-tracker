import styles from './StarRating.module.css';

export default function StarRating({ rating, size = 14 }) {
  if (rating === null || rating === undefined) {
    return <span style={{ color: "#6b7280", fontSize: size - 2 }}>N/A</span>;
  }
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3;
  return (
    <span className={styles.container}>
      {[...Array(5)].map((_, i) => (
        <span key={i} style={{ fontSize: size, color: i < full || (i === full && half) ? "#facc15" : "#3f3f46" }}>
          {i < full ? "★" : i === full && half ? "★" : "☆"}
        </span>
      ))}
      <span style={{ color: "#a1a1aa", fontSize: size - 2, marginLeft: 4, fontWeight: 600 }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}
