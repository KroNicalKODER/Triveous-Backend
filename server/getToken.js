/**
 * Middleware to verify JWT token from cookies.
 * Checks for access_token cookie, verifies token with JWT secret,
 * and adds user to request if valid.
 * Returns 401 UNAUTHENTICATED error if no token.
 * Returns 403 INVALID USER error if invalid token.
 */
import jwt from "jsonwebtoken";
import genError from "./error.js";

const getToken = (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return next(genError(401, "UNAUTHENTICATED USER"));

  jwt.verify(token, process.env.JWT, (err, user) => {
    if (err) return next(genError(403, "INVALID USER"));
    req.user = user;
    next();
  });
};
export default getToken;
