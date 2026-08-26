import { useEffect } from "react";
import { useRouter } from "expo-router";

// Redirect target for the opencode://connect deep link (static app shortcut).
// Lands on the connections tab where the add-connection flow lives.
export default function ConnectRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/connections");
  }, [router]);
  return null;
}
