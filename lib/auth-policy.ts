import { z } from 'zod';
const email=z.string().trim().toLowerCase().email().max(254);
const password=z.string().min(1).max(128);
const newPassword=z.string().min(12).max(128);
const otp=z.string().regex(/^\d{6}$/);
export const authSchemas={
 'sign-in/email':z.strictObject({email,password,rememberMe:z.boolean().optional()}),
 'sign-up/email':z.strictObject({email,password:newPassword,name:z.string().trim().min(1).max(100)}),
 'sign-out':z.strictObject({}),
 'email-otp/send-verification-otp':z.strictObject({email,type:z.enum(['email-verification','forget-password'])}),
 'email-otp/verify-email':z.strictObject({email,otp}),
 'email-otp/reset-password':z.strictObject({email,otp,password:newPassword}),
};
export type AuthPath=keyof typeof authSchemas;
export function authFailure(status:number){
 if(status===429)return {code:'TOO_MANY_REQUESTS',message:'Too many attempts. Please wait and try again.'};
 if(status>=500)return {code:'AUTH_UNAVAILABLE',message:'Unable to complete authentication. Please try again.'};
 return {code:'AUTH_FAILED',message:'Unable to complete authentication. Check your details or use password recovery.'};
}
export const emailSendingPath='email-otp/send-verification-otp';
