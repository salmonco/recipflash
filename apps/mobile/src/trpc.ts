import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/src/index'; // Adjust path as needed

export const trpc = createTRPCReact<AppRouter>();