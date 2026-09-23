import * as Haptics from "expo-haptics";

async function safe(call: () => Promise<void>): Promise<void> {
  try {
    await call();
  } catch {
    // Haptics are best-effort (unsupported device, web, permissions).
  }
}

export function hapticLight(): Promise<void> {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMedium(): Promise<void> {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticHeavy(): Promise<void> {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export function hapticSuccess(): Promise<void> {
  return safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function hapticError(): Promise<void> {
  return safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );
}

export function hapticSelection(): Promise<void> {
  return safe(() => Haptics.selectionAsync());
}
