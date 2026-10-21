'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AttentionItem } from '@/lib/gea-operations';
import s from './operations.module.css';

export default function AttentionOverview() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/operations/attention', { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { if (!controller.signal.aborted) { setItems(result.items); setStatus('ready'); } })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, []);
  return <section className={s.panel} aria-busy={status === 'loading'}>
    <h2>Workspace updates</h2>
    {status === 'loading' && <p role="status">Loading updates…</p>}
    {status === 'error' && <p role="alert">Updates could not load. Your workspace records are still available.</p>}
    {status === 'ready' && !items.length && <p>No pending updates.</p>}
    {items.slice(0, 5).map(item => <Link key={item.key} href={item.href} className={s.updateRow}><div><span className={s.badge}>{item.category}</span><h3>{item.title}</h3><p>{item.detail}</p></div></Link>)}
  </section>;
}
