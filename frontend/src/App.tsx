import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BuildPaperProvider } from "@/contexts/BuildPaperContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import WorkspacePage from "./pages/Workspace";
import Papers from "./pages/Papers";
import Documents from "./pages/Documents";
import BuildPaper from "./pages/BuildPaper";

const App = () => (
  <AuthProvider>
    <TooltipProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(240 6% 7%)",
            color: "hsl(240 5% 90%)",
            border: "1px solid hsl(240 4% 16%)",
            fontSize: "14px",
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <BuildPaperProvider>
                  <Layout />
                </BuildPaperProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workspace/:id" element={<WorkspacePage />} />
            <Route path="/papers" element={<Papers />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/build-paper" element={<BuildPaper />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
