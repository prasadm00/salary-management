import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/employees', label: 'Employees', end: true },
  { to: '/employees/new', label: 'Add employee', end: true },
];

/** The frame around every page: the title, the menu, and the place where the page goes. */
export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Lets keyboard users jump past the menu. It only appears when it gets focus. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>

      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-lg font-semibold">ACME Salary Management</span>
          <nav aria-label="Main" className="flex gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium hover:bg-muted',
                    isActive && 'bg-muted text-foreground underline underline-offset-4',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none">
        <Outlet />
      </main>
    </div>
  );
}
