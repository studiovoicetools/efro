"use client";

export default function ChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-12 px-4 rounded-lg bg-white text-gray-800 text-sm font-medium border border-gray-300 shadow hover:bg-gray-50"
      type="button"
    >
      Chat oeffnen
    </button>
  );
}
