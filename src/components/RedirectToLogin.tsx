import { Navigate, useLocation } from "react-router-dom";

/** ใช้แทน <Navigate to="/login" replace /> เพื่อเก็บ URL เดิมไว้ให้ login redirect กลับ */
const RedirectToLogin = () => {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: { pathname: location.pathname + location.search } }} />;
};

export default RedirectToLogin;
