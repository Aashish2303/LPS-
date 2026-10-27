import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LPS · Lean Project Delivery',description:'Make work ready. Keep reliable promises. Learn from every week.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
