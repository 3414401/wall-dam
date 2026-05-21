import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getUser } from "./lib/auth";
import { Home } from "./pages/Home";
import { Homogeneity } from "./pages/Homogeneity";
import { Login } from "./pages/Login";
import { RandomProject } from "./pages/RandomProject";
import { WallCreate } from "./pages/wall/WallCreate";
import { WallCreateAssign } from "./pages/wall/WallCreateAssign";
import { WallCreateSurvey } from "./pages/wall/WallCreateSurvey";
import { WallHome } from "./pages/wall/WallHome";
import { WallJoin } from "./pages/wall/WallJoin";
import { WallResults } from "./pages/wall/WallResults";

function RequireAuth({ children }: { children: ReactNode }) {
  const user = getUser();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/homogeneity"
        element={
          <RequireAuth>
            <Homogeneity />
          </RequireAuth>
        }
      />
      <Route
        path="/random"
        element={
          <RequireAuth>
            <RandomProject />
          </RequireAuth>
        }
      />
      <Route
        path="/wall"
        element={
          <RequireAuth>
            <WallHome />
          </RequireAuth>
        }
      />
      <Route
        path="/wall/create"
        element={
          <RequireAuth>
            <WallCreate />
          </RequireAuth>
        }
      />
      <Route
        path="/wall/create/survey"
        element={
          <RequireAuth>
            <WallCreateSurvey />
          </RequireAuth>
        }
      />
      <Route
        path="/wall/create/assign"
        element={
          <RequireAuth>
            <WallCreateAssign />
          </RequireAuth>
        }
      />
      <Route
        path="/wall/join"
        element={
          <RequireAuth>
            <WallJoin />
          </RequireAuth>
        }
      />
      <Route
        path="/wall/results"
        element={
          <RequireAuth>
            <WallResults />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
