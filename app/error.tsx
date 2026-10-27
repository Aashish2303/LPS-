'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="errorpage"><h1>Something interrupted this page.</h1><p>Please refresh the page or try again.</p><button onClick={reset}>Try again</button></main>}
