import { analyze } from '../server/handlers.js';
export const POST = (req: Request) => analyze(req);
