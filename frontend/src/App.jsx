import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Logout from './pages/Logout';
import ChangePassword from './pages/ChangePassword';
import Redirect from './pages/Redirect';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/change_pass" element={<ChangePassword />} />
        <Route path="/:shortKey" element={<Redirect />} />
      </Route>
    </Routes>
  );
}
