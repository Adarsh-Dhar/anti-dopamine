'use client'; // Required for buttons/hooks in App Router

export default function Popup() {
  
  const handleLog = () => {
    // 1. Logs to the popup's isolated console
    console.log("Hello World from Next.js!");
    
    // 2. Alert to verify it works visually
    alert("Hello World!");
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
        Log Hello World
      </button>
    </div>
  );
}