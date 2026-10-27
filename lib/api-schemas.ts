import {z} from 'zod';
import {commandSchema} from './domain';
export const createProjectSchema=z.strictObject({name:z.string().trim().min(1).max(200)});
const email=z.string().trim().toLowerCase().email().max(254);
export const apiCommandSchema=z.union([
 commandSchema,
 z.strictObject({type:z.literal('member'),email,role:z.enum(['editor','viewer'])}),
 z.strictObject({type:z.literal('removeMember'),email}),
 z.strictObject({type:z.literal('importTasks'),tasks:z.array(commandSchema).min(1).max(500).refine(tasks=>tasks.every(t=>t.type==='task'),'Schedule imports contain only activities.')}),
]);
export const projectRequestSchema=z.strictObject({requestId:z.string().uuid(),version:z.number().int().positive().max(2147483646),command:apiCommandSchema});
