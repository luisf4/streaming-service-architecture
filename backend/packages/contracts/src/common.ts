import { z } from "zod";

export const Resolution = z.enum(["240p", "360p", "480p", "720p", "1080p"]);
export type Resolution = z.infer<typeof Resolution>;
