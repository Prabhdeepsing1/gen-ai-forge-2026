export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin ${className}`}
    />
  );
}
