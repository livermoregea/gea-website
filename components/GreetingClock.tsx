'use client';
import { useEffect, useState } from 'react';
import { workspaceGreeting } from '@/lib/workspace-greeting';
import s from './workspace-greeting.module.css';

export default function GreetingClock({ name, initialGreeting }: { name?: string | null; initialGreeting: string }) {
  const [greeting, setGreeting] = useState(initialGreeting);
  useEffect(() => {
    const update = () => setGreeting(workspaceGreeting());
    update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const displayName = name?.trim();
  return <h1 className={s.greeting}>{greeting}{displayName ? <>, <span className={s.name}>{displayName}</span></> : ''}.</h1>;
}
