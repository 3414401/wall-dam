import { ReactNode } from "react";
import { StarsBackground } from "./StarsBackground";

interface LayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
}

export function Layout({ title, subtitle, children, onBack }: LayoutProps) {
  return (
    <div className="app-shell">
      <StarsBackground />
      <div className="page-content">
        {onBack && (
          <button type="button" className="back-link" onClick={onBack}>
            ← 뒤로
          </button>
        )}
        <header className="page-header">
          <div className="logo-row">
            <span className="logo-icon" aria-hidden>
              🧱⭐
            </span>
          </div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
