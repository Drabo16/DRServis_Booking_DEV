export default function TestEventPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Test Event Page</h1>
      <p className="mt-4">
        Pokud vidíš tuto stránku, routing funguje. Problém je specifický pro
        dynamic route [id].
      </p>
      <p className="mt-2 text-sm text-slate-600">
        URL: /test-event
      </p>
    </div>
  );
}
