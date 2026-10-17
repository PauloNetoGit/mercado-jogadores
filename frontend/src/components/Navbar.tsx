import Link from 'next/link';

export function Navbar() {
  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 font-bold text-white">
            P
          </span>
          <span className="text-xl font-bold tracking-tight text-gray-900">Passe</span>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-blue-600">Início</Link>
          <Link href="/jogadores" className="hover:text-blue-600">Jogadores</Link>
          <Link href="/clubes" className="hover:text-blue-600">Clubes</Link>
          <Link href="/partidas" className="hover:text-blue-600">Liga & Partidas</Link>
        </nav>
      </div>
    </header>
  );
}