import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import ProfilePage from './ProfilePage.js';
import LeaderboardPage from './LeaderboardPage.js';
import TournamentsPage from './TournamentsPage.js';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <nav className="app-nav">
          <div className="logo">
            Lichess<span className="logo-highlight">Stats</span>
          </div>
          <div className="nav-links">
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Profile
            </NavLink>
            <NavLink to="/leaderboards" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Leaderboards
            </NavLink>
            <NavLink to="/tournaments" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Tournaments
            </NavLink>
          </div>
        </nav>
      </header>

      <main className="main-content">
        <Routes>
          {/* Redirect from root to the default profile */}
          <Route path="/" element={<Navigate to="/profile" replace />} />

          {/* Route for /profile (no username) */}
          <Route path="/profile" element={<ProfilePage />} />
          
          {/* Route for /profile/:username */}
          <Route path="/profile/:username" element={<ProfilePage />} />

          <Route path="/leaderboards" element={<LeaderboardPage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
        </Routes>
      </main>
      
      <footer className="app-footer">
        <p>Powered by the <a href="https://lichess.org/api" target="_blank" rel="noopener noreferrer">Lichess.org API</a></p>
      </footer>
    </div>
  );
}

export default App;

