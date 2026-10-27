import { auth } from '@/lib/auth-server';
import {createAuthGateway} from '@/lib/auth-handler';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const upstream=auth.handler();
export const GET=createAuthGateway(upstream.GET);
export const POST=createAuthGateway(upstream.POST);
