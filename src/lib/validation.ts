import { z } from "zod";

// Normalizing the value before persistence keeps movie names consistent and rejects empty or oversized submissions early.
export const favoriteMovieSchema = z.object({
  movie: z
    .string()
    .trim()
    .min(2, "Favorite movie must contain at least 2 characters.")
    .max(120, "Favorite movie must be under 120 characters.")
    .refine((value) => value.trim().length > 0, {
      message: "Favorite movie cannot be empty.",
    }),
});
