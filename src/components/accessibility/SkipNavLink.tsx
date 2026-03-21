import React from "react";

interface SkipNavLinkProps {
  targetId: string;
  label?: string;
}

export const SkipNavLink: React.FC<SkipNavLinkProps> = ({
  targetId,
  label = "Skip to main content",
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView();
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="skip-nav-link"
      style={{
        position: "absolute",
        left: "-10000px",
        top: "auto",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        zIndex: 10000,
        padding: "8px 16px",
        background: "var(--aol-blue)",
        color: "var(--aol-white)",
        fontFamily: "var(--font-system)",
        fontSize: "var(--font-size-base)",
        textDecoration: "none",
        border: "2px solid var(--aol-white)",
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.style.position = "fixed";
        el.style.left = "8px";
        el.style.top = "8px";
        el.style.width = "auto";
        el.style.height = "auto";
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        el.style.position = "absolute";
        el.style.left = "-10000px";
        el.style.width = "1px";
        el.style.height = "1px";
      }}
      aria-label={label}
    >
      {label}
    </a>
  );
};

export default SkipNavLink;
