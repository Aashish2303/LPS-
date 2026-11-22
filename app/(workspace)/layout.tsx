import {Suspense} from 'react';
import Workspace from '@/components/workspace';
export default function WorkspaceLayout({children}:{children:React.ReactNode}){return <><Suspense fallback={<div className="loading"><p>Opening Lean Classroom…</p></div>}><Workspace/></Suspense>{children}</>}
