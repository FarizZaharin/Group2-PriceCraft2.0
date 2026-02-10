import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './components/shared/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import EstimatesPage from './pages/EstimatesPage';
import EstimateDetailPage from './pages/EstimateDetailPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<EstimatesPage />} />
                <Route path="estimates/:id" element={<EstimateDetailPage />} />
                <Route path="estimates/:id/sow" element={<EstimateDetailPage />} />
                <Route path="estimates/:id/boq" element={<EstimateDetailPage />} />
                <Route path="estimates/:id/summary" element={<EstimateDetailPage />} />
                <Route path="estimates/:id/audit" element={<EstimateDetailPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
