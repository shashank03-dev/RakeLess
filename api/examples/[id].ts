import { getExample } from '../../server/handlers.js';
export const GET = (req: Request) => getExample(new URL(req.url).pathname.split('/').pop() ?? '');
