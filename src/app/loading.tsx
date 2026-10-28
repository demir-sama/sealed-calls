export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-20" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-32" /><div className="skeleton mt-6 h-16 w-3/4 max-w-xl" /><div className="skeleton mt-4 h-5 w-1/2 max-w-md" />
      <div className="mt-12 grid gap-4 sm:grid-cols-3"><div className="skeleton h-40" /><div className="skeleton h-40" /><div className="skeleton h-40" /></div>
    </div>
  );
}
