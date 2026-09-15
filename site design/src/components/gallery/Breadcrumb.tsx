import React from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  className = "",
}) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 type-label ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1 || item.current;
        return (
          <React.Fragment key={item.label}>
            {index > 0 && (
              <span className="text-[var(--dim)] select-none font-normal">›</span>
            )}
            {isLast ? (
              <span className="text-[var(--bone)] font-medium" aria-current="page">
                {item.label}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                className="text-[var(--dim)] hover:text-[var(--bone)] transition-colors duration-[120ms]"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-[var(--dim)]">{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
