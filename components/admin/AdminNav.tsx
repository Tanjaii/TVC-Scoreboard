"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Staff navigation">
      {links.map((l) => {
        const here = l.href === "/admin" ? path === "/admin" || path.startsWith("/admin/matches") : path.startsWith(l.href);
        return <Link key={l.href} href={l.href} aria-current={here ? "page" : undefined}>{l.label}</Link>;
      })}
    </nav>
  );
}
