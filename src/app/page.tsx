import { getCurrentUser } from "@/lib/auth";
import { DirectoryApp } from "@/components/directory-app";
import { LoginScreen } from "@/components/login-screen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  return user ? <DirectoryApp initialUser={user} /> : <LoginScreen />;
}

