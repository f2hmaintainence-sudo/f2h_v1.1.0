"use client";
import React from "react";

interface BreadcrumbItem {
  label?: string;
  icon?: React.ReactNode;
  href?: string;
}

interface BreadcrumbProps {
  title: string;
  items: BreadcrumbItem[];
}

const Breadcrumb = ({ title, items }: BreadcrumbProps) => {
  return (
    <div className="perm-page-header">
      <h3 className="perm-page-title" style={{ fontWeight: 700, fontSize: "1.5rem" }}>
        {title}
      </h3>
      <nav className="perm-breadcrumb" style={{ display: "flex", alignItems: "center", gap: "2px", marginTop: "2px" }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <React.Fragment key={index}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "0.78rem",
                  fontWeight: isLast ? 600 : 400,
                  color: isLast ? "#16a34a" : "#6b7280",
                }}
              >
                {item.icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{item.icon}</span>}
                {item.label && <span>{item.label}</span>}
              </span>
              {!isLast && (
                <span style={{ color: "#d1d5db", fontSize: "0.78rem", margin: "0 2px" }}>/</span>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};

export default Breadcrumb;