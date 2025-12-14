"use client";
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";

export function Breadcrumbs(){
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const paths = parts.map((_,i) => "/" + parts.slice(0, i+1).join("/"));
  const labels = parts.map(p => p === "admin" ? "Admin" : p === "user" ? "Dashboard" : p[0].toUpperCase() + p.slice(1));
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      {labels.map((l,i) => (
        <span key={i}>
          <span className="sep">/</span>
          <Link href={paths[i]} aria-current={i === labels.length - 1 ? "page" : undefined}>{l}</Link>
        </span>
      ))}
    </nav>
  );
}

