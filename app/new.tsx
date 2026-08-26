import { useEffect } from "react";
import { useRouter } from "expo-router";

// Redirect target for the opencode://new deep link (static app shortcut +
// §2.8 deep link scheme). Routes to the sessions tab and opens the
// NewSessionModal via the openNew param.
export default function NewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: "/", params: { openNew: "1" } });
  }, [router]);
  return null;
}
