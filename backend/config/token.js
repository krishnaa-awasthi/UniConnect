// backend/config/token.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing in environment. Exiting...");
  process.exit(1);
}

// Token expiry (default 1d if not set in .env)
const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "1d";

/**
 * Sign a new JWT token for the user
 * @param {Object} user - Mongoose user object
 * @returns {string} - Signed JWT
 */
export const signToken = (user) => {
  return jwt.sign(
    { _id: user._id.toString(), collegeId: user.collegeId },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
};

/**
 * Verify a given JWT token
 * @param {string} token
 * @returns {Object} - Decoded payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Extract JWT token from headers or cookies
 * @param {Object} req - Express request
 * @returns {string|null}
 */
export const extractTokenFromRequest = (req) => {
  const header = req.headers.authorization || "";
  const tokenFromHeader = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (tokenFromHeader) return tokenFromHeader;

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\\s*)accessToken=(.+?)(?:;|$)/);

  if (match) return decodeURIComponent(match[1]);

  return null;
};
