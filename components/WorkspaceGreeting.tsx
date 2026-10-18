import { workspaceGreeting } from '@/lib/workspace-greeting';
import GreetingClock from './GreetingClock';

export default function WorkspaceGreeting({ name }: { name?: string | null }) {
  return <GreetingClock name={name} initialGreeting={workspaceGreeting()} />;
}
