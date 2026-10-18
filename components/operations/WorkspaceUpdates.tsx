'use client';
import type { OperationsData } from '@/lib/gea-operations-data';
import { downloadFile } from '@/lib/gea-operations';
import { schoolDate } from '@/lib/officer-tracking';
import type { SaveAction } from './MeetingWorkspace';
import s from './operations.module.css';

export default function WorkspaceUpdates({ data, save, busy, compact = false }: { data: OperationsData; save: SaveAction; busy: boolean; compact?: boolean }) {
  const unseen = data.attention.filter(item => !data.readKeys.includes(item.key));
  const items = compact ? data.attention.filter(item => !['Tasks', 'Calendar'].includes(item.category) && !item.key.startsWith('task-review:')) : data.attention;
  const visible = items.slice(0, 5);
  return <div className={s.overviewColumns}>
    <section className={s.panel}>
      <h2>{compact ? 'Other next steps' : 'Needs your attention'}</h2>
      {!compact && <p className={s.muted}>Open an item to act on it. Pending work stays here until it is resolved.</p>}
      {items.length ? visible.map(item => <a className={s.updateRow} href={item.href} key={item.key}>
        <div>
          <span className={s.badge}>{item.category}</span>{!data.readKeys.includes(item.key) && <span className={s.newLabel}>New</span>}
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
          {item.date && <p className={s.muted}>{schoolDate(item.date, item.date.length > 10)}</p>}
        </div>
      </a>) : <p>No other actions needed.</p>}
      {items.length > visible.length && <details className={s.quietDisclosure}><summary>{items.length - visible.length} more updates</summary>{items.slice(visible.length).map(item => <a className={s.updateRow} href={item.href} key={item.key}><span className={s.badge}>{item.category}</span><h3>{item.title}</h3><p>{item.detail}</p></a>)}</details>}
    </section>
    <details className={`${s.panel} ${s.summaryColumn} ${s.noPrint}`}>
      <summary>Updates &amp; weekly summaries{unseen.length ? ` · ${unseen.length} new` : ''}</summary>
      <p className={s.muted}>These are reminders about the work above. Marking an update as seen does not complete the work.</p>
      <div className={s.actions}>
        <button disabled={busy || !unseen.length} onClick={() => save('mark_gea_notifications', { p_keys: unseen.map(item => item.key) }, 'Updates marked as seen across your devices.')}>Mark updates as seen</button>
        <button disabled={busy} onClick={() => save('set_gea_digest', { p_enabled: !data.digestEnabled }, data.digestEnabled ? 'Weekly summaries disabled.' : 'Weekly summaries enabled.')}>{data.digestEnabled ? 'Disable weekly summaries' : 'Enable weekly summaries'}</button>
      </div>
      {data.digests.map(digest => <details key={digest.id}>
        <summary>Week of {schoolDate(digest.week_of, false)} · {digest.items.length} items</summary>
        {digest.items.map((item, index) => <p className={s.row} key={index}><a href={item.href}>{item.title}</a><span>{item.detail}</span></p>)}
        {!digest.items.length && <p>No pending items when this summary was created.</p>}
        <button onClick={() => downloadFile(`gea-week-${digest.week_of}.txt`, digest.items.map(item => `${item.title}\n${item.detail}\n${new URL(item.href, window.location.origin).href}`).join('\n\n'), 'text/plain;charset=utf-8')}>Download summary</button>
      </details>)}
      {!data.digests.length && <p className={s.muted}>Enable weekly summaries to keep a weekly snapshot here.</p>}
    </details>
  </div>;
}
