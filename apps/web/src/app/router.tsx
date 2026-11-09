import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout, PublicLayout } from '../components/Layout';
import { useAuth } from '../features/auth/AuthContext';
import type { JSX } from 'react';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import ResourcesPage from '../pages/ResourcesPage';
import ResourceDetailPage from '../pages/ResourceDetailPage';
import CoursesPage from '../pages/CoursesPage';
import CourseDetailPage from '../pages/CourseDetailPage';
import MyCoursesPage from '../pages/MyCoursesPage';
import PracticePage from '../pages/PracticePage';
import PlaygroundPage from '../pages/PlaygroundPage';
import ExamsPage from '../pages/ExamsPage';
import ExamDetailPage from '../pages/ExamDetailPage';
import ExamCreatePage from '../pages/ExamCreatePage';
import PricingPage from '../pages/PricingPage';
import AdminPage from '../pages/AdminPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace state={{ redirect: location.pathname }} />;
  return children;
}

const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/pricing', element: <PricingPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <RequireAuth><DashboardPage /></RequireAuth> },
      { path: '/resources', element: <ResourcesPage /> },
      { path: '/resources/:id', element: <ResourceDetailPage /> },
      { path: '/courses', element: <CoursesPage /> },
      { path: '/courses/:id', element: <CourseDetailPage /> },
      { path: '/my-courses', element: <RequireAuth><MyCoursesPage /></RequireAuth> },
      { path: '/practice', element: <RequireAuth><PracticePage /></RequireAuth> },
      { path: '/playground', element: <RequireAuth><PlaygroundPage /></RequireAuth> },
      { path: '/exams', element: <ExamsPage /> },
      { path: '/exams/new', element: <RequireAuth><ExamCreatePage /></RequireAuth> },
      { path: '/exams/:id', element: <RequireAuth><ExamDetailPage /></RequireAuth> },
      { path: '/admin', element: <RequireAuth><AdminPage /></RequireAuth> },
      { path: '*', element: <div className="rounded-lg border border-border bg-white p-8 text-center"><h1 className="text-xl font-bold">Không tìm thấy trang</h1><p className="mt-2 text-sm text-slate-500">Đường dẫn bạn truy cập không tồn tại.</p></div> },
    ],
  },
];
export const router = createBrowserRouter(routes);
