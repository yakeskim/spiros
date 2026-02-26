"use client";

interface PixelButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  href?: string;
  className?: string;
  onClick?: () => void;
}

export default function PixelButton({
  children,
  variant = "primary",
  href,
  className = "",
  onClick,
}: PixelButtonProps) {
  const base = "font-pixel text-[10px] sm:text-xs px-6 py-3 border-2 transition-all cursor-pointer inline-block text-center";

  const variants = {
    primary:
      "bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold hover:brightness-110 active:shadow-pixel-pressed active:translate-x-[2px] active:translate-y-[2px]",
    ghost:
      "bg-transparent text-text-bright border-border-light shadow-pixel hover:bg-bg-panel-light hover:border-border-highlight active:shadow-pixel-pressed active:translate-x-[2px] active:translate-y-[2px]",
  };

  const classes = `${base} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
