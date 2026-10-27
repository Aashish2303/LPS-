import {Suspense} from 'react';
import Workspace from '@/components/workspace';
export default function WorkspaceLayout({children}:{children:React.ReactNode}){return <><Suspense fallback={<div className="loading"><p>Opening LPS…</p></div>}><Workspace/></Suspense>{children}</>}
