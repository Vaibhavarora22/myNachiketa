import React from 'react';

// A simple loading spinner component
export const Loader = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-500"></div>
  </div>
);

// Component to display an error message
export const ErrorMessage = ({ message }) => (
  <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative my-4" role="alert">
    <strong className="font-bold">Error: </strong>
    <span className="block sm:inline">{message}</span>
  </div>
);

// A card for displaying user statistics
export const StatCard = ({ label, value }) => (
  <div className="bg-gray-800 p-4 rounded-lg text-center shadow-md">
    <p className="text-sm text-gray-400">{label}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);
