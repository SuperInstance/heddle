import type { PropsWithChildren } from 'react';
import { Button } from '@/web/components/ui/button';
import { cn } from '@/web/lib/utils';
import type { NavigationItem } from './types';

interface AppFrameProps {
  activeItemId: string;
  navigationItems: NavigationItem[];
}

// AppFrame owns only shell placement. Workflow state should stay in feature
// views and server-backed API clients.
export function AppFrame({ activeItemId, navigationItems, children }: PropsWithChildren<AppFrameProps>) {
  return (
    <div className="grid min-h-screen grid-cols-[15rem_minmax(0,1fr)_20rem] bg-background text-foreground">
      <aside className="border-r bg-card/40" aria-label="Primary navigation">
        <div className="border-b px-4 py-3 text-sm font-medium">Heddle</div>
        <nav className="grid gap-1 p-2">
          {navigationItems.map((item) => (
            <Button
              key={item.id}
              className={cn('justify-start', item.id === activeItemId && 'bg-accent text-accent-foreground')}
              variant="ghost"
              type="button"
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0">{children}</main>

      <aside className="border-l bg-card/30" aria-label="Context inspector" />
    </div>
  );
}
