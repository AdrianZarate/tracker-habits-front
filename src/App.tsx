import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HabitDetails from './pages/HabitDetails';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rutas públicas */}
          <Route path='/login' element={<Login />} />

          {/* Rutas protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route path='/dashboard' element={<Dashboard />} />
            <Route path='/habits/:id' element={<HabitDetails />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path='*' element={<Navigate to='/dashboard' replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
