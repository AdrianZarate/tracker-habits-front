export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent ${className}`}
    />
  );
}
