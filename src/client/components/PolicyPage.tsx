import type { ReactNode } from 'react';

// Shared frame for /privacy-policy and /terms-of-use. The text in those pages describes the
// official Pika server and Chrome extension; self-hosters should edit it to match.
export const POLICY_UPDATED = 'October 24, 2026';
export const ISSUES_URL = 'https://github.com/SamWang8891/pika/issues';
export const REMOVAL_EMAIL = 'g348.8891@gmail.com';

export default function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page">
      <article className="card policy animate-fade-in-up" style={{ marginTop: 16 }}>
        <h2>{title}</h2>
        <p className="policy-updated">Last updated: {POLICY_UPDATED}</p>
        {children}
      </article>
    </div>
  );
}
