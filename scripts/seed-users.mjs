import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está configurada");
const sql = neon(url);
const family = [
  { email: "josebarriosetc@gmail.com", name: "José Barrios", role: "admin" },
  { email: "adrianafrancoetc@gmail.com", name: "Adriana Franco", role: "member" },
  { email: "juanbarriosetc@gmail.com", name: "Juan Barrios", role: "member" },
  { email: "edgarbarriosetc@gmail.com", name: "Edgar Barrios", role: "member" },
];

const created = [];
for (const member of family) {
  const existing = await sql`SELECT id, must_change_password, last_login_at FROM users WHERE email=${member.email}`;
  if (existing[0] && (!existing[0].must_change_password || existing[0].last_login_at)) continue;
  const password = `${randomBytes(14).toString("base64url")}!Aa7`;
  const hash = await bcrypt.hash(password, 12);
  if (existing[0]) {
    await sql`UPDATE users SET password_hash=${hash}, name=${member.name}, role=${member.role},
      must_change_password=true, updated_at=now() WHERE id=${existing[0].id}`;
  } else {
    await sql`
      INSERT INTO users(email, name, password_hash, role, must_change_password)
      VALUES (${member.email}, ${member.name}, ${hash}, ${member.role}, true)
    `;
  }
  created.push({ ...member, temporaryPassword: password });
}

console.log(`CREDENTIALS_B64=${Buffer.from(JSON.stringify(created)).toString("base64")}`);
