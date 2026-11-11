import React from "react";
import { BriefcaseBusiness, ArrowRight } from "lucide-react";
export function StudioIntro({ hasRole = false }: { hasRole?: boolean }) {
  return (
    <header className="studio-intro">
      <p className="studio-signature"><span>Sponsor Intel</span>{" "}<span>Application Studio</span></p>
      <h1>{hasRole ? "Make this application yours." : "Put your best evidence forward."}</h1>
      <p className="studio-intro-copy">{hasRole
        ? "Read the role carefully. Draw on your experience. Review each document before it leaves your hands."
        : "A practical workspace for a thoughtful application. Start with a real role and your own experience."}</p>
    </header>
  );
}
export function Title({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="career-heading">
      <div>
        <p className="eyebrow">{label}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  label,
}: {
  title: string;
  text: string;
  action: () => void;
  label: string;
}) {
  return (
    <div className="career-empty">
      <span>
        <BriefcaseBusiness size={28} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary-button" onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

