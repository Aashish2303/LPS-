import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
let pool:Pool|undefined;
export function db(){if(!pool){if(!process.env.DATABASE_URL)throw new Error('Database is not configured');pool=new Pool({connectionString:process.env.DATABASE_URL,max:4,idleTimeoutMillis:5000,connectionTimeoutMillis:15000});attachDatabasePool(pool);}return pool;}
