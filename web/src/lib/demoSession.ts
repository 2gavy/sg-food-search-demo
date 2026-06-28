const SESSION_KEY = "sg-food-demo-session";

export function getDemoSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export function agentHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Demo-Session": getDemoSessionId(),
  };
}
