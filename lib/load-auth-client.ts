'use client';
type Client=typeof import('./auth-client')['authClient'];
let pending:Promise<Client>|undefined;
export function getAuthClient():Promise<Client>{
 if(!pending)pending=import('./auth-client').then(module=>module.authClient).catch(error=>{pending=undefined;throw error;});
 return pending;
}
