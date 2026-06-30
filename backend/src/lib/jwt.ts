import jwt from 'jsonwebtoken';

export function decodeJwtHeader(token: string): jwt.Jwt | null {
  const decoded = jwt.decode(token, { complete: true });
  return decoded;
}
