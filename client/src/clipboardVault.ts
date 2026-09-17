let pendingSecret: string | null = null;
let timer: number | null = null;

function cancelTimer() {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

async function wipeIfNeeded() {
  const secret = pendingSecret;
  if (!secret) return false;
  try {
    const current = await navigator.clipboard.readText();
    if (current === secret) await navigator.clipboard.writeText("");
    pendingSecret = null;
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText("");
      pendingSecret = null;
      return true;
    } catch {
      return false;
    }
  }
}

export function hasCopiedPassword() {
  return !!pendingSecret;
}

export async function copyVaultPassword(secret: string, seconds: number) {
  await navigator.clipboard.writeText(secret);
  pendingSecret = secret;
  cancelTimer();
  const ms = Math.max(5, seconds) * 1000;
  timer = window.setTimeout(() => {
    timer = null;
    void wipeIfNeeded();
  }, ms);
}

export async function clearCopiedPasswordNow() {
  cancelTimer();
  if (!pendingSecret) return false;
  const ok = await wipeIfNeeded();
  pendingSecret = null;
  return ok;
}
