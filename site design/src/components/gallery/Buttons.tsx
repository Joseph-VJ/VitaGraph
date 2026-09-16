import React from "react";

export type ButtonVariant = "primary" | "ghost" | "outline-danger" | "solid-danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}) => {
  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--verdigris)] text-[var(--ink-900)] font-medium hover:brightness-105 active:brightness-95 border border-transparent shadow-sm",
    ghost:
      "bg-transparent text-[var(--bone)] border border-[var(--line-strong)] hover:bg-[var(--ink-700)] active:bg-[var(--ink-600)]",
    "outline-danger":
      "bg-transparent text-[var(--madder)] border border-[var(--madder)] hover:bg-[rgba(217,128,141,0.12)] active:bg-[rgba(217,128,141,0.2)]",
    "solid-danger":
      "bg-[var(--madder)] text-[var(--ink-900)] font-medium hover:brightness-105 active:brightness-95 border border-transparent",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[var(--r-6)] type-body transition-[filter,background-color,border-color,transform] duration-[120ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--verdigris)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ink-900)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin w-3.5 h-3.5 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  title?: string;
  size?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  title,
  size = 28,
  disabled = false,
  className = "",
  ...props
}) => {
  return (
    <button
      title={title}
      disabled={disabled}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`inline-flex items-center justify-center rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] text-[var(--bone)] hover:bg-[var(--ink-700)] active:bg-[var(--ink-600)] transition-[background-color,border-color,transform] duration-[120ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--verdigris)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ink-900)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
