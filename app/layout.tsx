import type { Metadata } from 'next';
import './globals.css';
import localFont from 'next/font/local';
const dmSans=localFont({src:'./fonts/dm-sans-latin.woff2',weight:'400 700',display:'swap',variable:'--font-dm-sans'});
const manrope=localFont({src:'./fonts/manrope-latin.woff2',weight:'400 800',display:'swap',variable:'--font-manrope'});
export const metadata:Metadata={title:'Lean Classroom · Construction Planning Lab',description:'Make work ready. Keep reliable promises. Learn from every week.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={`${dmSans.variable} ${manrope.variable}`}><body>{children}</body></html>}
