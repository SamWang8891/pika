import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Admin from './pages/Admin'
import ChangePassword from './pages/ChangePassword'
import Home from './pages/Home'
import Login from './pages/Login'
import Logout from './pages/Logout'
import Settings from './pages/Settings'

// Same pages as the web app, minus the short-link redirect page (links open on
// the backend itself) and plus Settings for picking that backend.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/change_pass" element={<ChangePassword />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
