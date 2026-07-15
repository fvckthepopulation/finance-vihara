import { redirect } from "next/navigation";

// Landing on the app root just punts to /dashboard. The AppShell's auth guard
// handles the unauthenticated case (token check → /login bounce), so there's
// no need to duplicate that logic here.
export default function Home() {
  redirect("/dashboard");
}
