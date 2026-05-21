const STARS = [
  { top: "8%", left: "12%", size: 14, delay: 0 },
  { top: "15%", left: "78%", size: 18, delay: 0.4 },
  { top: "28%", left: "45%", size: 12, delay: 0.8 },
  { top: "42%", left: "8%", size: 10, delay: 1.2 },
  { top: "55%", left: "88%", size: 16, delay: 0.2 },
  { top: "70%", left: "25%", size: 11, delay: 1.5 },
  { top: "82%", left: "65%", size: 15, delay: 0.6 },
];

export function StarsBackground() {
  return (
    <div className="stars-bg" aria-hidden>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            animationDelay: `${s.delay}s`,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
