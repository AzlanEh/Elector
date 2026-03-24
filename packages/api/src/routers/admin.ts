import { adminProcedure } from "../index";

export const adminRouter = {
  healthCheck: adminProcedure.handler(() => {
    return { ok: true };
  }),
};
