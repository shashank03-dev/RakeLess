import { getExample } from '../../server/handlers';
export const GET = (req: Request) => getExample(new URL(req.url).pathname.split('/').pop() ?? '');
