import React from "react";
import { BriefcaseBusiness, ArrowRight } from "lucide-react";
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

