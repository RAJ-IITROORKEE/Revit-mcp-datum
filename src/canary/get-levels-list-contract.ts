import { z } from "zod";

export const getLevelsListContract = {
  name: "get_levels_list",
  input: z.object({
    includeNonStructural: z.boolean().default(true),
    sortByElevation: z.boolean().default(true),
  }).strict(),
} as const;
