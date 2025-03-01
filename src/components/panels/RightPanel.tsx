import React, { useState } from 'react';

export const RightPanel = () => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement query handling
    console.log('Query submitted:', query);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full">
      <h2 className="text-xl font-semibold mb-4">Learn</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-32 p-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="What would you like to learn about? (e.g., 'teach me about water molecules')"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Learn
        </button>
        <div className="space-y-2">
          <button
            type="button"
            className="w-full bg-gray-100 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-200 transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Quiz Me
          </button>
          <button
            type="button"
            className="w-full bg-gray-100 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-200 transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Suggest Topic
          </button>
        </div>
      </form>
    </div>
  );
}; 