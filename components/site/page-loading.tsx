export function PageLoading({ label = "Loading page…" }: { label?: string }) {
  return <main className="shell content-page"><p className="muted-copy" role="status">{label}</p></main>;
}
