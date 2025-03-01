import React, { useState } from 'react';

export const InputPanel = () => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement query handling
    console.log('Query submitted:', query);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-3 h-full border border-gray-700">
      <h2 className="text-lg font-semibold mb-3 text-white">Learn</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-32 p-2 bg-gray-700 border-gray-600 rounded-lg resize-none 
            focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
          placeholder="What would you like to learn about? (e.g., 'teach me about water molecules')"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 
            transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          Learn
        </button>
        <div className="space-y-2">
          <button
            type="button"
            className="w-full bg-gray-700 text-gray-200 py-2 px-3 rounded-lg hover:bg-gray-600 
              transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Quiz Me
          </button>
          <button
            type="button"
            className="w-full bg-gray-700 text-gray-200 py-2 px-3 rounded-lg hover:bg-gray-600 
              transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Suggest Topic
          </button>
        </div>
      </form>
    </div>
  );
}; 