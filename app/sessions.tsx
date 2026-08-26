import { useEffect } from "react";
import { useRouter } from "expo-router";

// Redirect target for the opencode://sessions deep link (§2.8). The sessions
// tab IS the root route, so this just normalizes the URL path.
export default function SessionsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
