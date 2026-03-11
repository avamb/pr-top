import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const homeLink = token ? '/dashboard' : '/';
  const homeLinkText = token ? 'Go to Dashboard' : 'Go to Home';

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-8xl font-bold text-teal-600 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-stone-800 mb-4">Page Not Found</h2>
        <p className="text-stone-600 mb-2">
          The page <code className="bg-stone-200 px-2 py-0.5 rounded text-sm">{location.pathname}</code> does not exist.
        </p>
        <p className="text-stone-500 mb-8">
          It may have been moved or the URL might be incorrect.
        </p>
        <Link
          to={homeLink}
          className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          {homeLinkText}
        </Link>
      </div>
    </div>
  );
}
