// src/pages/NotFound.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaExclamationTriangle, FaArrowLeft } from 'react-icons/fa';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10] px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <FaExclamationTriangle className="text-5xl text-red-500 dark:text-red-400" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Page Not Found</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            <FaArrowLeft className="text-xs" />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center px-6 py-3 bg-teal-600 hover:bg-teal-700 dark:bg-[#0d9488] dark:hover:bg-[#0f9e96] text-white rounded-xl text-sm font-medium transition"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;