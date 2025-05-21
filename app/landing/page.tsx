import Link from 'next/link';

export const metadata = {
  title: 'Sci-Viz AI – Explore Molecules with AI',
  description: 'Interactive AI-powered molecular visualisation for both small molecules and large macromolecules',
};

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white px-6">
      {/* Hero */}
      <section className="w-full max-w-4xl text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
          Welcome to <span className="text-indigo-400">Sci-Viz&nbsp;AI</span>
        </h1>
        <p className="text-lg md:text-2xl text-gray-300">
          AI-assisted 3-D visualisation of atoms, molecules, and massive biomacromolecules – right in your browser.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-lg font-semibold transition-colors"
        >
          Get Started
        </Link>
      </section>

      {/* Feature Highlights */}
      <section className="w-full max-w-5xl mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            title: 'Small & Large Molecules',
            desc: 'From methane to ribosomes – one viewer, infinite scale.',
          },
          {
            title: 'Natural-Language Prompts',
            desc: 'Ask for a molecule by name; the AI fetches, converts, and renders it instantly.',
          },
          {
            title: 'GPU-Optimised Rendering',
            desc: 'Smart instancing and point clouds keep frame-rates smooth, even with >100k atoms.',
          },
        ].map((f) => (
          <div key={f.title} className="bg-white/5 p-6 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold mb-2 text-indigo-300">{f.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
} 