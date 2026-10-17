'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AttentionItem } from '@/lib/gea-operations';
import s from './operations.module.css';
export default function AttentionOverview() {
    const [items, setItems] = useState<AttentionItem[]>([]), [state, setState] = useState('loading'), [workspaceHref, setWorkspaceHref] = useState('/officerboard');
    useEffect(() => { const controller = new AbortController(); fetch('/api/operations/attention', { signal: controller.signal, cache: 'no-store' }).then(async (r) => { if (!r.ok)
        throw new Error(); return r.json(); }).then(result => { setItems(result.items); setWorkspaceHref(result.workspaceHref || '/officerboard'); setState('ready'); }).catch(e => { if (e.name !== 'AbortError')
        setState('error'); }); return () => controller.abort(); }, []);
    return <section className={s.panel}>
      <div className={s.panelHeading}>
        <h3 className="text-xl font-semibold text-forest">Needs your attention</h3>
        <Link className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4" href={workspaceHref}>Open officer workspace →</Link>
      </div>
      {state === 'loading' ? <p role="status">Loading your next actions…</p>
        : state === 'error' ? <p>Could not load next actions. <Link href={workspaceHref} className="underline">Open workspace</Link></p>
        : items.length ? <ul className="divide-y divide-forest/10">{items.slice(0, 6).map(item => <li key={item.key}>
          <Link href={item.href} className={s.updateRow}><h3>{item.title}</h3><p className={s.muted}>{item.detail}</p></Link>
        </li>)}</ul> : <p>No pending work or upcoming obligations.</p>}
      {items.length > 6 && <p className="mt-3 text-sm">{items.length - 6} more items in your workspace.</p>}
    </section>;
}
