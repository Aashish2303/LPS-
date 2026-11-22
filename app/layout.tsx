import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Lean Classroom · Construction Planning Lab',description:'Make work ready. Keep reliable promises. Learn from every week.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
