'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="errorpage"><h1>Something interrupted this page.</h1><p>Your saved project is still in the database.</p><button onClick={reset}>Try again</button></main>}
