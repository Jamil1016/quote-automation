export default function NotAuthorized() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-paper text-ink">
      <div className="text-center">
        <h1 className="font-display text-2xl">Not authorized</h1>
        <p className="text-muted mt-2">Your account doesn&apos;t have access to Quote Automation.</p>
      </div>
    </main>
  );
}
