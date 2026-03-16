import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import { auth } from "./lib/firebase";
import {
  buildSessionUser,
  getOfficeProfileForAuthUser,
} from "./lib/userProfile.services";

import "./App.css";

const BackButtonManager = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const guardTimeoutRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ensureGuardState = (targetUrl) => {
      if (!window.history.state || !window.history.state.guard) {
        window.history.pushState(
          { guard: true },
          "",
          targetUrl || window.location.href
        );
      }
    };

    if (user) {
      ensureGuardState("/dashboard");
      return;
    }

    if (location.pathname === "/" || location.pathname === "/login") {
      ensureGuardState();
    }
  }, [user, location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const attemptCloseWindow = () => {
      window.close();
      setTimeout(() => {
        if (!window.closed) {
          window.location.replace("about:blank");
        }
      }, 100);
    };

    const handlePopState = () => {
      const path = window.location.pathname;

      if (user) {
        if (path !== "/dashboard") {
          navigate("/dashboard", { replace: true });
        }
        if (guardTimeoutRef.current) {
          clearTimeout(guardTimeoutRef.current);
        }
        guardTimeoutRef.current = setTimeout(() => {
          window.history.pushState({ guard: true }, "", "/dashboard");
        }, 0);
        return;
      }

      if (path === "/" || path === "/login") {
        attemptCloseWindow();
        window.history.pushState({ guard: true }, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (guardTimeoutRef.current) {
        clearTimeout(guardTimeoutRef.current);
      }
    };
  }, [user, navigate]);

  return null;
};

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (authUser) => {
      try {
        if (!authUser) {
          setUser(null);
          localStorage.removeItem("user");
          setIsLoading(false);
          return;
        }

        const officeProfile = await getOfficeProfileForAuthUser(authUser);
        if (!officeProfile) {
          // Signed-in user without profile should not access dashboard.
          await signOut(auth);
          setUser(null);
          localStorage.removeItem("user");
          setIsLoading(false);
          return;
        }

        const userData = buildSessionUser(authUser, officeProfile);
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
      } catch (error) {
        console.error("Session restore error:", error);
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("user");
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <BackButtonManager user={user} />
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
