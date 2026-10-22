import { analyze } from '../server/handlers';
export const POST = (req: Request) => analyze(req);
