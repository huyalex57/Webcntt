import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout, PublicLayout } from '../components/layout';
import { RequireAuth, RequirePlan, RequireRole } from './guards';

const LoadingFallback = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const HomePage = lazy(() => import('../pages/HomePage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ResourcesPage = lazy(() => import('../pages/ResourcesPage'));
const ResourceDetailPage = lazy(() => import('../pages/ResourceDetailPage'));
const CoursesPage = lazy(() => import('../pages/CoursesPage'));
const CourseDetailPage = lazy(() => import('../pages/CourseDetailPage'));
const MyCoursesPage = lazy(() => import('../pages/MyCoursesPage'));
const PracticePage = lazy(() => import('../pages/PracticePage'));
const PlaygroundPage = lazy(() => import('../pages/PlaygroundPage'));
const ExamsPage = lazy(() => import('../pages/ExamsPage'));
const ExamDetailPage = lazy(() => import('../pages/ExamDetailPage'));
const ExamCreatePage = lazy(() => import('../pages/ExamCreatePage'));
const PricingPage = lazy(() => import('../pages/PricingPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));

const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: '/login',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: '/register',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <RegisterPage />
          </Suspense>
        ),
      },
      {
        path: '/pricing',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PricingPage />
          </Suspense>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        ),
      },
      {
        path: '/reset-password',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ResetPasswordPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: '/dashboard',
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <DashboardPage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: '/profile',
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <ProfilePage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: '/resources',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ResourcesPage />
          </Suspense>
        ),
      },
      {
        path: '/resources/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ResourceDetailPage />
          </Suspense>
        ),
      },
      {
        path: '/courses',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CoursesPage />
          </Suspense>
        ),
      },
      {
        path: '/courses/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CourseDetailPage />
          </Suspense>
        ),
      },
      {
        path: '/my-courses',
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <MyCoursesPage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: '/practice',
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <PracticePage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: '/playground',
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <PlaygroundPage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: '/exams',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ExamsPage />
          </Suspense>
        ),
      },
      {
        path: '/exams/new',
        element: (
          <RequireAuth>
            <RequireRole allowed={['LECTURER', 'ADMIN']}>
              <RequirePlan min="PREMIUM">
                <Suspense fallback={<LoadingFallback />}>
                  <ExamCreatePage />
                </Suspense>
              </RequirePlan>
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: '/exams/:id',
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <ExamDetailPage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireAuth>
            <RequireRole allowed={['ADMIN', 'MODERATOR']}>
              <Suspense fallback={<LoadingFallback />}>
                <AdminPage />
              </Suspense>
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: '*',
        element: (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <h1 className="text-xl font-bold">Không tìm thấy trang</h1>
            <p className="mt-2 text-sm text-slate-500">Đường dẫn bạn truy cập không tồn tại.</p>
          </div>
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
