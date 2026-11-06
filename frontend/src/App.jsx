import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Privacy from "./pages/Privacy.jsx";
import ProjectPage from "./pages/ProjectPage";
import MyTasks from "./pages/MyTasks";
import InvitePage from "./pages/InvitePage";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// A fresh ProjectPage per project, so switching in the sidebar never shows stale data
function ProjectRoute() {
  const { id } = useParams();
  return <ProjectPage key={id} />;
}

// The timeline used to be its own page; it's now a tab, so old links still work
function OldTimelineLink() {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}?tab=timeline`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/invite/:token"
        element={
          <ProtectedRoute>
            <InvitePage />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-tasks" element={<MyTasks />} />
        <Route path="/projects/:id" element={<ProjectRoute />} />
        <Route path="/projects/:id/timeline" element={<OldTimelineLink />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
