import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer demo={false} />
    </div>
  );
}
