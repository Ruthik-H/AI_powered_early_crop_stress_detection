import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import DiseasePage from './pages/DiseasePage'
import HistoryPage from './pages/HistoryPage'
import PestRiskPage from './pages/PestRiskPage'
import YieldPage from './pages/YieldPage'
import AssistantPage from './pages/AssistantPage'
import ReportPage from './pages/ReportPage'


function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/register" element={<Navigate to="/dashboard" replace />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="map" element={<MapPage />} />
        <Route path="disease" element={<DiseasePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="pest-risk" element={<PestRiskPage />} />
        <Route path="yield" element={<YieldPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="report" element={<ReportPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#141f17',
              color: '#e8f5e9',
              border: '1px solid #1e3323',
              borderRadius: '12px',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
