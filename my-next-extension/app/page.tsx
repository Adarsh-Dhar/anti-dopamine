'use client'; // Required for buttons/hooks in App Router

import { useState } from "react";

export default function Popup() {
  const [message, setMessage] = useState("");

  const handleLog = () => {
    setMessage("Hello World from Next.js!");
  };

  return (
    <div className="w-[300px] h-[400px] p-4 flex flex-col items-center justify-center bg-white text-black">
      <h1 className="text-xl font-bold mb-4">Next.js Extension</h1>
      <p className="mb-4 text-center text-sm text-gray-600">
        This works exactly like a normal web page.
      </p>
      <button 
        onClick={handleLog}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Show Hello World
      </button>
      {message && (
        <div className="mt-4 p-2 bg-gray-100 rounded text-blue-700 text-center w-full">
          {message}
        </div>
      )}
    </div>
  );
}