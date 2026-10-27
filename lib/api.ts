import { auth } from './auth-server';
import { DomainError } from './domain';
export {sameOrigin,readJSON,privateHeaders} from './request-security';
export {publicFailure as failure} from './request-security';
export async function identity(){const {data:session}=await auth.getSession();if(!session?.user)throw new DomainError('Sign in to continue',401);return {id:session.user.id,email:session.user.email.toLowerCase(),verified:session.user.emailVerified};}
