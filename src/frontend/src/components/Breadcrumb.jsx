import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Breadcrumb navigation component.
 * Usage: <Breadcrumb items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Clients', to: '/clients' }, { label: 'John Doe' }]} />
 * The last item (without 'to') is rendered as plain text (current page).
 */
export default function Breadcrumb({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-stone-500">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-stone-400 mx-1" aria-hidden="true">/</span>
            )}
            {item.to ? (
              <Link
                to={item.to}
                className="text-teal-600 hover:text-teal-700 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-stone-800 font-medium" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
