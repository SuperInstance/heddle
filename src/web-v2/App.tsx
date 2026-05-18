import { AppFrame } from './layout/AppFrame';
import { NAV_ITEMS } from './layout/navigation';

export function App() {
  return (
    <AppFrame activeItemId="sessions" navigationItems={NAV_ITEMS}>
      <div />
    </AppFrame>
  );
}
