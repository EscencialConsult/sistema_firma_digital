import { AppError } from "../../utils/AppError.js";
import { getUserProfile, updateUserProfile } from "./repository.js";

export const userService = {
  async me(userId: string) {
    const user = await getUserProfile(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Usuario no encontrado.");
    return user;
  },
  updateMe(userId: string, input: { fullName?: string }) {
    return updateUserProfile(userId, input);
  }
};

