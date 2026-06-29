import { Link, Route, Routes } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            Telecopilot AI
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link to="/" className="transition hover:text-white">
              Home
            </Link>
            <a href="https://vite.dev/guide/" className="transition hover:text-white">
              Vite Docs
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Frontend scaffold
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Vite, React, and Tailwind are ready.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            This starter includes React Router, React Query, Zustand, and Tailwind CSS for the next phases.
          </p>
        </section>

        <Routes>
          <Route
            path="/"
            element={
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
                The application shell is scaffolded and ready for the next implementation steps.
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
