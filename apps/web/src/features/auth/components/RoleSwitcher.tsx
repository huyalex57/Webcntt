import { useMemo } from 'react';
import { DEMO_IDENTITIES, useAuth } from '../AuthContext';
import { Select } from '../../../components/ui/Select';

export function RoleSwitcher() {
  const { user, demoKey, switchDemo } = useAuth();

  const currentDemoKey = useMemo(() => {
    if (!user) return 'guest';
    const found = DEMO_IDENTITIES.find((d) => d.key === demoKey);
    if (found?.user && found.user.role === user.role && found.user.plan === user.plan) {
      return demoKey;
    }
    const matched = DEMO_IDENTITIES.find(
      (d) => d.user && d.user.role === user.role && d.user.plan === user.plan
    );
    return matched?.key ?? demoKey;
  }, [user, demoKey]);

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="hidden xl:inline">Role test:</span>
      <Select
        value={currentDemoKey}
        onChange={(e) => switchDemo(e.target.value)}
        className="h-8 py-1 text-xs"
        aria-label="Chọn role demo"
      >
        {DEMO_IDENTITIES.map((d) => (
          <option key={d.key} value={d.key}>
            {d.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
